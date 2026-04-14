import json
import sys
import os
import re
import pandas as pd
import pyreadstat
from typing import Dict, List, Any, Optional, Tuple

class SASReader:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.df = None
        self.meta = None
        self.column_names = []
        self.column_labels = {}
        self.column_formats = {}
        self.variable_types = {}

    def load_file(self):
        """Load SAS file and metadata"""
        try:
            self.df, self.meta = pyreadstat.read_sas7bdat(self.file_path)
            self.column_names = list(self.df.columns)

            # Extract metadata
            if self.meta:
                self.column_labels = self.meta.column_names_to_labels or {}
                self.column_formats = self.meta.original_variable_types or {}
                # Create variable types mapping
                for col in self.df.columns:
                    if self.df[col].dtype == 'object':
                        self.variable_types[col] = 'character'
                    else:
                        self.variable_types[col] = 'numeric'

            return True
        except Exception as e:
            return f"Error loading file: {str(e)}"

    def get_metadata(self) -> Dict[str, Any]:
        """Get dataset metadata"""
        if self.df is None:
            return {"error": "File not loaded"}

        variables = []
        for col in self.column_names:
            # Get column info from DataFrame
            col_dtype = self.df[col].dtype
            col_length = None

            # Calculate length for string columns
            if col_dtype == 'object':
                max_len = self.df[col].astype(str).str.len().max()
                col_length = int(max_len) if pd.notna(max_len) else None

            var_info = {
                "name": col,
                "type": self.variable_types.get(col, "unknown"),
                "label": self.column_labels.get(col, ""),
                "format": self.column_formats.get(col, ""),
                "length": col_length,
                "dtype": str(col_dtype)  # pandas dtype info
            }
            variables.append(var_info)

        # Get dataset label if available
        dataset_label = None
        if self.meta:
            # Check various possible metadata attributes for dataset label
            # In SAS, the dataset label appears as "description"
            possible_attrs = ['description', 'table_name', 'file_label', 'name', 'label']
            for attr in possible_attrs:
                if hasattr(self.meta, attr):
                    label_value = getattr(self.meta, attr, '')
                    if label_value and label_value.strip():
                        dataset_label = label_value.strip()
                        break

            # If no specific label found, use filename without extension as fallback
            if not dataset_label:
                import os
                filename_base = os.path.splitext(os.path.basename(self.file_path))[0]
                dataset_label = f"Dataset: {filename_base}"

        return {
            "total_rows": len(self.df),
            "total_variables": len(self.column_names),
            "variables": variables,
            "file_path": self.file_path,
            "dataset_label": dataset_label
        }

    def parse_where_condition(self, where_clause: str) -> Optional[pd.Series]:
        """Parse and apply WHERE condition to dataframe using pandas query"""
        if not where_clause or not where_clause.strip():
            return None

        try:
            original_clause = where_clause.strip()

            # Create case-insensitive column name mapping
            column_mapping = {}
            for col in self.column_names:
                column_mapping[col.upper()] = col

            # Replace column names with actual case-sensitive names
            query_clause = original_clause

            # Sort by length (descending) to replace longer names first
            # This prevents partial replacements (e.g., "NAME" in "FIRSTNAME")
            for upper_col in sorted(column_mapping.keys(), key=len, reverse=True):
                actual_col = column_mapping[upper_col]
                # Use word boundaries to match whole column names
                import re
                pattern = r'\b' + re.escape(upper_col) + r'\b'
                query_clause = re.sub(pattern, actual_col, query_clause, flags=re.IGNORECASE)
            
            # Replace SAS operators with pandas query equivalents
            query_clause = re.sub(r'\bEQ\b', '==', query_clause, flags=re.IGNORECASE)
            query_clause = re.sub(r'\bNE\b', '!=', query_clause, flags=re.IGNORECASE)
            query_clause = re.sub(r'\bGT\b', '>', query_clause, flags=re.IGNORECASE)
            query_clause = re.sub(r'\bLT\b', '<', query_clause, flags=re.IGNORECASE)
            query_clause = re.sub(r'\bGE\b', '>=', query_clause, flags=re.IGNORECASE)
            query_clause = re.sub(r'\bLE\b', '<=', query_clause, flags=re.IGNORECASE)

            # Support both AND/OR keywords and &/| symbols
            query_clause = re.sub(r'\bAND\b', ' and ', query_clause, flags=re.IGNORECASE)
            query_clause = re.sub(r'\bOR\b', ' or ', query_clause, flags=re.IGNORECASE)
            # Also handle & and | symbols (with proper spacing)
            query_clause = re.sub(r'\s*&\s*', ' and ', query_clause)
            query_clause = re.sub(r'\s*\|\s*', ' or ', query_clause)
            
            # Handle single = to ==
            query_clause = re.sub(r'([^!<>=])\s*=\s*([^=])', r'\1 == \2', query_clause)
            
            # Use pandas query method instead of eval
            filtered_df = self.df.query(query_clause)
            
            # Return the boolean mask
            condition = self.df.index.isin(filtered_df.index)
            return condition

        except Exception as e:
            # Try to provide more helpful error messages
            error_msg = str(e)

            # Check for common issues
            if "not in index" in error_msg.lower():
                # Extract the problematic column name if possible
                import re
                match = re.search(r"'([^']+)'", error_msg)
                if match:
                    bad_col = match.group(1)
                    available_cols = ', '.join(self.column_names[:5])
                    if len(self.column_names) > 5:
                        available_cols += f', ... ({len(self.column_names)} total)'
                    error_msg = f"Column '{bad_col}' not found. Available columns: {available_cols}"
                else:
                    error_msg = f"Invalid column name in WHERE clause. Available columns: {', '.join(self.column_names[:10])}"
            elif "invalid syntax" in error_msg.lower():
                error_msg = f"Syntax error in WHERE clause. Please check your operators and quotes. Example: AGE > 30 and GENDER = 'M'"
            elif "cannot compare" in error_msg.lower():
                error_msg = "Type mismatch in comparison. Make sure to use quotes for string values and no quotes for numbers."

            # Fallback: try simple column-based filtering for basic cases
            try:
                return self.parse_simple_condition(original_clause)
            except Exception as fallback_error:
                # If both fail, provide comprehensive error message
                raise ValueError(f"Invalid WHERE clause '{original_clause}': {error_msg}")
    
    def parse_simple_condition(self, where_clause: str) -> Optional[pd.Series]:
        """Fallback parser for simple conditions like COLUMN = 'VALUE'"""
        
        # Handle simple equality: COLUMN = 'VALUE'
        match = re.match(r'^\s*(\w+)\s*=\s*[\'"]([^\'"]*)[\'"]?\s*$', where_clause, re.IGNORECASE)
        if match:
            col_name, value = match.groups()
            
            # Find the actual column name (case insensitive)
            actual_col = None
            for col in self.column_names:
                if col.upper() == col_name.upper():
                    actual_col = col
                    break
            
            if actual_col:
                condition = self.df[actual_col] == value
                return condition
        
        # Handle simple numeric comparison: COLUMN > VALUE
        match = re.match(r'^\s*(\w+)\s*([><=!]+)\s*(\d+(?:\.\d+)?)\s*$', where_clause, re.IGNORECASE)
        if match:
            col_name, operator, value = match.groups()
            
            # Find the actual column name
            actual_col = None
            for col in self.column_names:
                if col.upper() == col_name.upper():
                    actual_col = col
                    break
            
            if actual_col:
                numeric_value = float(value)
                if operator == '>':
                    condition = self.df[actual_col] > numeric_value
                elif operator == '<':
                    condition = self.df[actual_col] < numeric_value
                elif operator == '>=':
                    condition = self.df[actual_col] >= numeric_value
                elif operator == '<=':
                    condition = self.df[actual_col] <= numeric_value
                elif operator in ['=', '==']:
                    condition = self.df[actual_col] == numeric_value
                elif operator in ['!=', '<>']:
                    condition = self.df[actual_col] != numeric_value
                else:
                    raise ValueError(f"Unsupported operator: {operator}")
                return condition
        
        raise ValueError(f"Could not parse simple condition: {where_clause}")

    def get_data(self, start_row: int = 0, num_rows: int = 100,
                 selected_vars: List[str] = None, where_clause: str = None) -> Dict[str, Any]:
        """Get data with pagination, variable selection, and filtering"""
        if self.df is None:
            return {"error": "File not loaded"}

        try:
            # OPTIMIZATION: Use view instead of copy when possible
            working_df = self.df

            # Apply WHERE condition if provided
            filtered_rows = len(working_df)
            if where_clause:
                condition = self.parse_where_condition(where_clause)
                if condition is not None:
                    # OPTIMIZATION: Use loc for better performance
                    working_df = working_df.loc[condition]
                    filtered_rows = len(working_df)

            # Select variables if specified
            if selected_vars:
                # OPTIMIZATION: Use intersection for faster validation
                valid_vars = list(set(selected_vars) & set(working_df.columns))
                # Preserve original order
                valid_vars = [v for v in selected_vars if v in valid_vars]
                if valid_vars:
                    working_df = working_df[valid_vars]

            # Apply pagination
            end_row = min(start_row + num_rows, len(working_df))
            page_df = working_df.iloc[start_row:end_row]

            # OPTIMIZATION: Use vectorized operations for data conversion
            # Convert to records first, then handle NaN and special types
            data = page_df.to_dict('records')

            # Fast type conversion for special types and handle NaN
            for row in data:
                for col, value in row.items():
                    # Handle NaN/null values
                    if pd.isna(value):
                        row[col] = None
                    elif isinstance(value, (pd.Timestamp, pd.Period)):
                        row[col] = str(value)
                    elif hasattr(value, 'isoformat'):
                        row[col] = value.isoformat()
                    elif isinstance(value, bytes):
                        row[col] = value.decode('utf-8', errors='ignore')
                    elif hasattr(value, 'item'):  # numpy types
                        row[col] = value.item()

            valid_row_count = len(data)

            # Removed debug print for performance
            
            return {
                "data": data,
                "total_rows": len(self.df),
                "filtered_rows": filtered_rows,
                "start_row": start_row,
                "returned_rows": len(data),
                "columns": list(page_df.columns)
            }

        except Exception as e:
            return {"error": f"Error retrieving data: {str(e)}"}

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        return

    command = sys.argv[1]

    try:
        if command == "load":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "File path required"}))
                return

            file_path = sys.argv[2]
            reader = SASReader(file_path)
            result = reader.load_file()

            if result is True:
                metadata = reader.get_metadata()
                print(json.dumps({"success": True, "metadata": metadata}))
            else:
                print(json.dumps({"error": result}))

        elif command == "data":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "File path required"}))
                return

            file_path = sys.argv[2]
            start_row = int(sys.argv[3]) if len(sys.argv) > 3 else 0
            num_rows = int(sys.argv[4]) if len(sys.argv) > 4 else 100
            selected_vars = sys.argv[5].split(',') if len(sys.argv) > 5 and sys.argv[5] else None
            where_clause = sys.argv[6] if len(sys.argv) > 6 else None

            reader = SASReader(file_path)
            load_result = reader.load_file()

            if load_result is not True:
                print(json.dumps({"error": load_result}))
                return

            data_result = reader.get_data(start_row, num_rows, selected_vars, where_clause)
            print(json.dumps(data_result))

        elif command == "metadata":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "File path required"}))
                return

            file_path = sys.argv[2]
            reader = SASReader(file_path)
            load_result = reader.load_file()

            if load_result is not True:
                print(json.dumps({"error": load_result}))
                return

            metadata = reader.get_metadata()
            print(json.dumps(metadata))

        else:
            print(json.dumps({"error": f"Unknown command: {command}"}))

    except Exception as e:
        print(json.dumps({"error": f"Unexpected error: {str(e)}"}))

if __name__ == "__main__":
    main()