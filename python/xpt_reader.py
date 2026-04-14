"""
Python script for reading SAS XPT (XPORT) files
Supports all XPORT versions including V8
"""

import sys
import json
from pathlib import Path
import pandas as pd

try:
    import pyreadstat
    HAS_PYREADSTAT = True
except ImportError:
    HAS_PYREADSTAT = False


def get_metadata(file_path):
    """Get metadata from XPT file including row count"""
    try:
        if HAS_PYREADSTAT:
            # Read the full file to get accurate row count and metadata
            # XPT files are typically small (FDA submissions), so this is acceptable
            df, meta = pyreadstat.read_xport(file_path)

            # Get variable information with proper labels
            variables = []

            # Use column_names from meta if available, otherwise from df
            column_names = meta.column_names if hasattr(meta, 'column_names') else df.columns.tolist()

            for i, col in enumerate(column_names):
                # Determine type from metadata or df
                var_type = 'numeric'  # Default to numeric
                if hasattr(meta, 'readstat_variable_types') and col in meta.readstat_variable_types:
                    var_type = 'character' if meta.readstat_variable_types[col] == 'string' else 'numeric'
                elif hasattr(meta, 'original_variable_types') and col in meta.original_variable_types:
                    # Some versions use original_variable_types
                    var_type = meta.original_variable_types[col]
                elif df is not None and col in df.columns:
                    dtype = str(df[col].dtype)
                    var_type = 'character' if dtype == 'object' else 'numeric'

                # Get label from metadata if available
                label = meta.column_labels[i] if meta.column_labels and i < len(meta.column_labels) else col

                variables.append({
                    'name': col,
                    'type': var_type,
                    'label': label,
                    'format': '',
                    'length': 8 if var_type == 'numeric' else 200,
                    'dtype': 'object' if var_type == 'character' else 'float64'
                })

            # Get actual row count from the loaded dataframe
            row_count = len(df) if df is not None else 0

            metadata = {
                'total_rows': row_count,
                'total_variables': len(variables),
                'variables': variables,
                'file_path': file_path,
                'dataset_label': meta.table_name if hasattr(meta, 'table_name') and meta.table_name else Path(file_path).stem
            }
        else:
            # Fallback: pandas doesn't have metadata-only mode, so we have to read the file
            # But we can at least read it just once
            df = pd.read_sas(file_path, format='xport')

            variables = []
            for col in df.columns:
                dtype = str(df[col].dtype)
                var_type = 'character' if dtype == 'object' else 'numeric'

                variables.append({
                    'name': col,
                    'type': var_type,
                    'label': col,
                    'format': '',
                    'length': 8 if var_type == 'numeric' else 200,
                    'dtype': dtype
                })

            metadata = {
                'total_rows': len(df),
                'total_variables': len(df.columns),
                'variables': variables,
                'file_path': file_path,
                'dataset_label': Path(file_path).stem
            }

        return {'metadata': metadata}

    except Exception as e:
        return {'error': f'Failed to read metadata: {str(e)}'}


def get_data(file_path, start_row, num_rows, selected_vars='', where_clause=''):
    """Get data from XPT file with optional filtering"""
    try:
        # Read XPT file
        if HAS_PYREADSTAT:
            df, meta = pyreadstat.read_xport(file_path)
        else:
            df = pd.read_sas(file_path, format='xport')

        # Apply WHERE clause filter if provided
        if where_clause:
            try:
                # Simple WHERE clause parsing
                df = apply_where_clause(df, where_clause)
            except Exception as e:
                print(f"Warning: WHERE clause filtering failed: {e}", file=sys.stderr)

        filtered_rows = len(df)

        # Apply variable selection if provided
        if selected_vars:
            var_list = [v.strip() for v in selected_vars.split(',') if v.strip()]
            if var_list:
                # Only keep variables that exist
                var_list = [v for v in var_list if v in df.columns]
                if var_list:
                    df = df[var_list]

        # Apply pagination
        df_page = df.iloc[start_row:start_row + num_rows]

        # Convert to records
        records = df_page.to_dict('records')

        # Handle NaN values
        for record in records:
            for key, value in record.items():
                if pd.isna(value):
                    record[key] = None

        result = {
            'data': records,
            'total_rows': filtered_rows,
            'filtered_rows': filtered_rows,
            'start_row': start_row,
            'returned_rows': len(records),
            'columns': list(df.columns)
        }

        return result

    except Exception as e:
        return {'error': f'Failed to read data: {str(e)}'}


def apply_where_clause(df, where_clause):
    """Apply a simple WHERE clause to the dataframe"""
    # Remove WHERE keyword if present
    clause = where_clause.strip()
    if clause.upper().startswith('WHERE '):
        clause = clause[6:].strip()

    # Simple parsing for basic conditions
    # This is a basic implementation - can be enhanced
    try:
        # Replace = with == for pandas query
        clause = clause.replace(' = ', ' == ')

        # Use pandas query method
        return df.query(clause)
    except:
        # If query fails, try eval (less safe but more flexible)
        return df[eval(clause)]


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: xpt_reader.py <command> <file_path> [args...]'}))
        sys.exit(1)

    command = sys.argv[1]

    if command == 'metadata':
        if len(sys.argv) < 3:
            print(json.dumps({'error': 'File path required'}))
            sys.exit(1)

        file_path = sys.argv[2]
        result = get_metadata(file_path)
        print(json.dumps(result))

    elif command == 'data':
        if len(sys.argv) < 6:
            print(json.dumps({'error': 'Usage: xpt_reader.py data <file> <start> <num> <vars> [where]'}))
            sys.exit(1)

        file_path = sys.argv[2]
        start_row = int(sys.argv[3])
        num_rows = int(sys.argv[4])
        selected_vars = sys.argv[5] if len(sys.argv) > 5 else ''
        where_clause = sys.argv[6] if len(sys.argv) > 6 else ''

        result = get_data(file_path, start_row, num_rows, selected_vars, where_clause)
        print(json.dumps(result))

    else:
        print(json.dumps({'error': f'Unknown command: {command}'}))
        sys.exit(1)


if __name__ == '__main__':
    main()
