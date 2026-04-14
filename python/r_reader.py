"""
Python script for reading R data files (.rds and .rdata/.rda)
Uses pyreadr library for reading R data formats
"""

import sys
import json
import re
from pathlib import Path
import pandas as pd
from typing import Dict, List, Any, Optional

try:
    import pyreadr
    HAS_PYREADR = True
except ImportError:
    HAS_PYREADR = False


class RDataReader:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.df = None
        self.column_names = []
        self.available_objects = []
        self.selected_object = None

    def load_file(self, object_name: str = None) -> bool:
        """Load R data file and select the appropriate data frame"""
        if not HAS_PYREADR:
            return "pyreadr library is not installed. Install with: pip install pyreadr"

        try:
            result = pyreadr.read_r(self.file_path)

            # Store available objects
            self.available_objects = list(result.keys())

            # For .rds files, the key is None
            if None in result:
                self.df = result[None]
                self.selected_object = None
            else:
                # For .rdata files, select the specified object or first data frame
                if object_name and object_name in result:
                    self.df = result[object_name]
                    self.selected_object = object_name
                else:
                    # Find first DataFrame
                    for name, obj in result.items():
                        if isinstance(obj, pd.DataFrame):
                            self.df = obj
                            self.selected_object = name
                            break

                    if self.df is None:
                        return "No data frames found in R data file"

            self.column_names = list(self.df.columns)
            return True

        except Exception as e:
            return f"Error loading file: {str(e)}"

    def get_metadata(self) -> Dict[str, Any]:
        """Get dataset metadata"""
        if self.df is None:
            return {"error": "File not loaded"}

        variables = []
        for col in self.column_names:
            col_dtype = self.df[col].dtype

            # Determine type
            if col_dtype == 'object':
                var_type = 'character'
            elif 'int' in str(col_dtype) or 'float' in str(col_dtype):
                var_type = 'numeric'
            elif 'datetime' in str(col_dtype) or 'date' in str(col_dtype):
                var_type = 'date'
            elif 'bool' in str(col_dtype):
                var_type = 'logical'
            else:
                var_type = 'numeric'

            # Calculate length for string columns
            col_length = None
            if col_dtype == 'object':
                max_len = self.df[col].astype(str).str.len().max()
                col_length = int(max_len) if pd.notna(max_len) else None

            var_info = {
                "name": col,
                "type": var_type,
                "label": "",  # R data frames don't typically have labels like SAS
                "format": "",
                "length": col_length,
                "dtype": str(col_dtype)
            }
            variables.append(var_info)

        # Build dataset label
        filename_base = Path(self.file_path).stem
        if self.selected_object:
            dataset_label = f"{filename_base} ({self.selected_object})"
        else:
            dataset_label = filename_base

        metadata = {
            "total_rows": len(self.df),
            "total_variables": len(self.column_names),
            "variables": variables,
            "file_path": self.file_path,
            "dataset_label": dataset_label,
            "available_objects": self.available_objects,
            "selected_object": self.selected_object
        }

        return metadata

    def parse_where_condition(self, where_clause: str) -> Optional[pd.Series]:
        """Parse and apply WHERE condition to dataframe"""
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
            for upper_col in sorted(column_mapping.keys(), key=len, reverse=True):
                actual_col = column_mapping[upper_col]
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
            query_clause = re.sub(r'\s*&\s*', ' and ', query_clause)
            query_clause = re.sub(r'\s*\|\s*', ' or ', query_clause)

            # Handle single = to ==
            query_clause = re.sub(r'([^!<>=])\s*=\s*([^=])', r'\1 == \2', query_clause)

            # Use pandas query method
            filtered_df = self.df.query(query_clause)
            condition = self.df.index.isin(filtered_df.index)
            return condition

        except Exception as e:
            # Try simple parsing as fallback
            try:
                return self.parse_simple_condition(original_clause)
            except:
                raise ValueError(f"Invalid WHERE clause '{where_clause}': {str(e)}")

    def parse_simple_condition(self, where_clause: str) -> Optional[pd.Series]:
        """Fallback parser for simple conditions"""
        # Handle simple equality: COLUMN = 'VALUE'
        match = re.match(r'^\s*(\w+)\s*=\s*[\'"]([^\'"]*)[\'"]?\s*$', where_clause, re.IGNORECASE)
        if match:
            col_name, value = match.groups()

            actual_col = None
            for col in self.column_names:
                if col.upper() == col_name.upper():
                    actual_col = col
                    break

            if actual_col:
                return self.df[actual_col] == value

        # Handle simple numeric comparison: COLUMN > VALUE
        match = re.match(r'^\s*(\w+)\s*([><=!]+)\s*(\d+(?:\.\d+)?)\s*$', where_clause, re.IGNORECASE)
        if match:
            col_name, operator, value = match.groups()

            actual_col = None
            for col in self.column_names:
                if col.upper() == col_name.upper():
                    actual_col = col
                    break

            if actual_col:
                numeric_value = float(value)
                if operator == '>':
                    return self.df[actual_col] > numeric_value
                elif operator == '<':
                    return self.df[actual_col] < numeric_value
                elif operator == '>=':
                    return self.df[actual_col] >= numeric_value
                elif operator == '<=':
                    return self.df[actual_col] <= numeric_value
                elif operator in ['=', '==']:
                    return self.df[actual_col] == numeric_value
                elif operator in ['!=', '<>']:
                    return self.df[actual_col] != numeric_value

        raise ValueError(f"Could not parse simple condition: {where_clause}")

    def get_data(self, start_row: int = 0, num_rows: int = 100,
                 selected_vars: List[str] = None, where_clause: str = None) -> Dict[str, Any]:
        """Get data with pagination, variable selection, and filtering"""
        if self.df is None:
            return {"error": "File not loaded"}

        try:
            working_df = self.df

            # Apply WHERE condition if provided
            filtered_rows = len(working_df)
            if where_clause:
                condition = self.parse_where_condition(where_clause)
                if condition is not None:
                    working_df = working_df.loc[condition]
                    filtered_rows = len(working_df)

            # Select variables if specified
            if selected_vars:
                valid_vars = [v for v in selected_vars if v in working_df.columns]
                if valid_vars:
                    working_df = working_df[valid_vars]

            # Apply pagination
            end_row = min(start_row + num_rows, len(working_df))
            page_df = working_df.iloc[start_row:end_row]

            # Convert to records
            data = page_df.to_dict('records')

            # Handle special types and NaN
            for row in data:
                for col, value in row.items():
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

    def get_filtered_row_count(self, where_clause: str) -> Dict[str, Any]:
        """Get count of rows matching WHERE clause without loading all data"""
        if self.df is None:
            return {"error": "File not loaded"}

        try:
            if not where_clause or not where_clause.strip():
                return {"count": len(self.df)}

            condition = self.parse_where_condition(where_clause)
            if condition is not None:
                count = condition.sum()
                return {"count": int(count)}
            else:
                return {"count": len(self.df)}

        except Exception as e:
            return {"error": f"Error counting rows: {str(e)}"}

    def get_unique_values(self, column_name: str, include_count: bool = False) -> Dict[str, Any]:
        """Get unique values for a column"""
        if self.df is None:
            return {"error": "File not loaded"}

        try:
            # Case-insensitive column lookup
            actual_col = None
            for col in self.column_names:
                if col.upper() == column_name.upper():
                    actual_col = col
                    break

            if actual_col is None:
                return {"error": f"Column '{column_name}' not found"}

            if include_count:
                value_counts = self.df[actual_col].value_counts(dropna=False)
                values = []
                for val, count in value_counts.items():
                    if pd.isna(val):
                        values.append({"value": None, "count": int(count)})
                    else:
                        values.append({"value": val if not hasattr(val, 'item') else val.item(),
                                      "count": int(count)})
                return {"values": values}
            else:
                unique_vals = self.df[actual_col].unique()
                values = []
                for val in unique_vals:
                    if pd.isna(val):
                        values.append(None)
                    elif hasattr(val, 'item'):
                        values.append(val.item())
                    else:
                        values.append(val)
                return {"values": values}

        except Exception as e:
            return {"error": f"Error getting unique values: {str(e)}"}


def list_objects(file_path: str) -> Dict[str, Any]:
    """List all objects in an R data file without fully loading them"""
    if not HAS_PYREADR:
        return {"error": "pyreadr library is not installed. Install with: pip install pyreadr"}

    try:
        result = pyreadr.read_r(file_path)

        objects = []
        for name, obj in result.items():
            obj_info = {
                "name": name if name is not None else "(default)",
                "type": type(obj).__name__,
                "is_dataframe": isinstance(obj, pd.DataFrame)
            }
            if isinstance(obj, pd.DataFrame):
                obj_info["rows"] = len(obj)
                obj_info["columns"] = len(obj.columns)
            objects.append(obj_info)

        return {"objects": objects, "file_path": file_path}

    except Exception as e:
        return {"error": f"Error listing objects: {str(e)}"}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided. Usage: r_reader.py <command> <args>"}))
        return

    command = sys.argv[1]

    try:
        if command == "metadata":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "File path required"}))
                return

            file_path = sys.argv[2]
            object_name = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None

            reader = RDataReader(file_path)
            load_result = reader.load_file(object_name)

            if load_result is not True:
                print(json.dumps({"error": load_result}))
                return

            metadata = reader.get_metadata()
            print(json.dumps({"metadata": metadata}))

        elif command == "data":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "File path required"}))
                return

            file_path = sys.argv[2]
            start_row = int(sys.argv[3]) if len(sys.argv) > 3 else 0
            num_rows = int(sys.argv[4]) if len(sys.argv) > 4 else 100
            selected_vars = sys.argv[5].split(',') if len(sys.argv) > 5 and sys.argv[5] else None
            where_clause = sys.argv[6] if len(sys.argv) > 6 else None
            object_name = sys.argv[7] if len(sys.argv) > 7 and sys.argv[7] else None

            reader = RDataReader(file_path)
            load_result = reader.load_file(object_name)

            if load_result is not True:
                print(json.dumps({"error": load_result}))
                return

            data_result = reader.get_data(start_row, num_rows, selected_vars, where_clause)
            print(json.dumps(data_result))

        elif command == "list_objects":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "File path required"}))
                return

            file_path = sys.argv[2]
            result = list_objects(file_path)
            print(json.dumps(result))

        elif command == "count":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "File path required"}))
                return

            file_path = sys.argv[2]
            where_clause = sys.argv[3] if len(sys.argv) > 3 else ''
            object_name = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else None

            reader = RDataReader(file_path)
            load_result = reader.load_file(object_name)

            if load_result is not True:
                print(json.dumps({"error": load_result}))
                return

            result = reader.get_filtered_row_count(where_clause)
            print(json.dumps(result))

        elif command == "unique":
            if len(sys.argv) < 4:
                print(json.dumps({"error": "File path and column name required"}))
                return

            file_path = sys.argv[2]
            column_name = sys.argv[3]
            include_count = sys.argv[4].lower() == 'true' if len(sys.argv) > 4 else False
            object_name = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] else None

            reader = RDataReader(file_path)
            load_result = reader.load_file(object_name)

            if load_result is not True:
                print(json.dumps({"error": load_result}))
                return

            result = reader.get_unique_values(column_name, include_count)
            print(json.dumps(result))

        else:
            print(json.dumps({"error": f"Unknown command: {command}"}))

    except Exception as e:
        print(json.dumps({"error": f"Unexpected error: {str(e)}"}))


if __name__ == "__main__":
    main()
