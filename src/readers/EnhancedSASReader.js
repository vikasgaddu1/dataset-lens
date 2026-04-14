"use strict";
/**
 * Enhanced SAS7BDAT Reader
 * Wrapper around js-stream-sas7bdat with fixes and additional features
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedSASReader = void 0;
var js_stream_sas7bdat_1 = require("js-stream-sas7bdat");
var path = __importStar(require("path"));
var EnhancedSASReader = /** @class */ (function () {
    function EnhancedSASReader(filePath) {
        this.dataCache = null;
        this.filePath = filePath;
        this.dataset = new js_stream_sas7bdat_1.DatasetSas7BDat(filePath);
    }
    /**
     * Get enhanced metadata with proper structure
     */
    EnhancedSASReader.prototype.getMetadata = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!!this.metadata) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, this.dataset.getMetadata()];
                    case 1:
                        _a.metadata = _d.sent();
                        _d.label = 2;
                    case 2: return [2 /*return*/, {
                            rowCount: this.metadata.records || 0,
                            columnCount: ((_b = this.metadata.columns) === null || _b === void 0 ? void 0 : _b.length) || 0,
                            variables: ((_c = this.metadata.columns) === null || _c === void 0 ? void 0 : _c.map(function (col) { return ({
                                name: col.name,
                                label: col.label || col.name, // Use name if label not available
                                type: col.dataType,
                                length: col.length,
                                format: col.displayFormat || col.format // Try to get format
                            }); })) || [],
                            encoding: this.metadata.encoding,
                            createdDate: this.metadata.datasetJSONCreationDateTime ?
                                new Date(this.metadata.datasetJSONCreationDateTime) : undefined,
                            modifiedDate: this.metadata.dbLastModifiedDateTime ?
                                new Date(this.metadata.dbLastModifiedDateTime) : undefined,
                            label: this.metadata.label || this.metadata.name || path.basename(this.filePath, '.sas7bdat')
                        }];
                }
            });
        });
    };
    /**
     * Get data as array of objects (like Python implementation)
     */
    EnhancedSASReader.prototype.getData = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var rawData, _a, columns, result, i, row, j, startRow, endRow;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.dataset.getData({ filterColumns: [] })];
                    case 1:
                        rawData = _b.sent();
                        if (!!this.metadata) return [3 /*break*/, 3];
                        _a = this;
                        return [4 /*yield*/, this.dataset.getMetadata()];
                    case 2:
                        _a.metadata = _b.sent();
                        _b.label = 3;
                    case 3:
                        columns = this.metadata.columns;
                        result = [];
                        // Convert array of arrays to array of objects
                        for (i = 0; i < rawData.length; i++) {
                            row = {};
                            for (j = 0; j < columns.length; j++) {
                                row[columns[j].name] = rawData[i][j];
                            }
                            result.push(row);
                        }
                        // Apply filtering
                        if (options) {
                            // Variable selection
                            if (options.variables && options.variables.length > 0) {
                                result = result.map(function (row) {
                                    var filteredRow = {};
                                    options.variables.forEach(function (varName) {
                                        if (varName in row) {
                                            filteredRow[varName] = row[varName];
                                        }
                                    });
                                    return filteredRow;
                                });
                            }
                            startRow = options.startRow || 0;
                            endRow = options.numRows ?
                                Math.min(startRow + options.numRows, result.length) :
                                result.length;
                            result = result.slice(startRow, endRow);
                        }
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Get raw data (array of arrays) for performance
     */
    EnhancedSASReader.prototype.getRawData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!this.dataCache) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, this.dataset.getData({ filterColumns: [] })];
                    case 1:
                        _a.dataCache = _b.sent();
                        _b.label = 2;
                    case 2: return [2 /*return*/, this.dataCache || []];
                }
            });
        });
    };
    /**
     * Get unique values for a single column (FIXED)
     */
    EnhancedSASReader.prototype.getUniqueValues = function (columnName_1) {
        return __awaiter(this, arguments, void 0, function (columnName, includeCount) {
            var _a, colIndex, data, countMap, _i, data_1, row, value, uniqueSet;
            if (includeCount === void 0) { includeCount = false; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!this.metadata) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, this.dataset.getMetadata()];
                    case 1:
                        _a.metadata = _b.sent();
                        _b.label = 2;
                    case 2:
                        colIndex = this.metadata.columns.findIndex(function (col) { return col.name === columnName; });
                        if (colIndex === -1) {
                            throw new Error("Column '".concat(columnName, "' not found"));
                        }
                        return [4 /*yield*/, this.getRawData()];
                    case 3:
                        data = _b.sent();
                        if (includeCount) {
                            countMap = new Map();
                            for (_i = 0, data_1 = data; _i < data_1.length; _i++) {
                                row = data_1[_i];
                                value = row[colIndex];
                                countMap.set(value, (countMap.get(value) || 0) + 1);
                            }
                            // Convert to array with counts
                            return [2 /*return*/, Array.from(countMap.entries()).map(function (_a) {
                                    var value = _a[0], count = _a[1];
                                    return ({
                                        value: value,
                                        count: count
                                    });
                                })];
                        }
                        else {
                            uniqueSet = new Set(data.map(function (row) { return row[colIndex]; }));
                            return [2 /*return*/, Array.from(uniqueSet)];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get unique combinations for multiple columns (NODUPKEY equivalent)
     */
    EnhancedSASReader.prototype.getUniqueCombinations = function (columnNames_1) {
        return __awaiter(this, arguments, void 0, function (columnNames, includeCount) {
            var _a, indices, data, countMap, _loop_1, _i, data_2, row, result, uniqueSet, uniqueValues, _loop_2, _b, data_3, row;
            var _this = this;
            if (includeCount === void 0) { includeCount = false; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!!this.metadata) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, this.dataset.getMetadata()];
                    case 1:
                        _a.metadata = _c.sent();
                        _c.label = 2;
                    case 2:
                        indices = columnNames.map(function (name) {
                            var idx = _this.metadata.columns.findIndex(function (col) { return col.name === name; });
                            if (idx === -1) {
                                throw new Error("Column '".concat(name, "' not found"));
                            }
                            return idx;
                        });
                        return [4 /*yield*/, this.getRawData()];
                    case 3:
                        data = _c.sent();
                        if (includeCount) {
                            countMap = new Map();
                            _loop_1 = function (row) {
                                var values = indices.map(function (i) { return row[i]; });
                                var key = JSON.stringify(values);
                                if (countMap.has(key)) {
                                    countMap.get(key).count++;
                                }
                                else {
                                    countMap.set(key, { values: values, count: 1 });
                                }
                            };
                            for (_i = 0, data_2 = data; _i < data_2.length; _i++) {
                                row = data_2[_i];
                                _loop_1(row);
                            }
                            result = Array.from(countMap.values()).map(function (item) {
                                var row = {};
                                columnNames.forEach(function (name, i) {
                                    row[name] = item.values[i];
                                });
                                row['_count'] = item.count;
                                return row;
                            });
                            return [2 /*return*/, result];
                        }
                        else {
                            uniqueSet = new Set();
                            uniqueValues = [];
                            _loop_2 = function (row) {
                                var values = indices.map(function (i) { return row[i]; });
                                var key = JSON.stringify(values);
                                if (!uniqueSet.has(key)) {
                                    uniqueSet.add(key);
                                    uniqueValues.push(values);
                                }
                            };
                            for (_b = 0, data_3 = data; _b < data_3.length; _b++) {
                                row = data_3[_b];
                                _loop_2(row);
                            }
                            return [2 /*return*/, uniqueValues];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Apply WHERE clause filtering (basic implementation)
     */
    EnhancedSASReader.prototype.getFilteredData = function (whereClause) {
        return __awaiter(this, void 0, void 0, function () {
            var data, condition;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getData()];
                    case 1:
                        data = _a.sent();
                        condition = this.parseWhereClause(whereClause);
                        return [2 /*return*/, data.filter(function (row) { return _this.evaluateCondition(row, condition); })];
                }
            });
        });
    };
    EnhancedSASReader.prototype.parseWhereClause = function (where) {
        // Simple parser - extend as needed
        // For now, handle basic comparisons
        var match = where.match(/(\w+)\s*([><=!]+)\s*(.+)/);
        if (match) {
            var field = match[1], operator = match[2], value = match[3];
            return { field: field, operator: operator, value: this.parseValue(value.trim()) };
        }
        return null;
    };
    EnhancedSASReader.prototype.parseValue = function (value) {
        // Remove quotes if string
        if (value.startsWith("'") && value.endsWith("'")) {
            return value.slice(1, -1);
        }
        // Try to parse as number
        var num = Number(value);
        return isNaN(num) ? value : num;
    };
    EnhancedSASReader.prototype.evaluateCondition = function (row, condition) {
        if (!condition)
            return true;
        var field = condition.field, operator = condition.operator, value = condition.value;
        var fieldValue = row[field];
        switch (operator) {
            case '=':
            case '==':
                return fieldValue == value;
            case '!=':
            case '<>':
                return fieldValue != value;
            case '>':
                return fieldValue > value;
            case '<':
                return fieldValue < value;
            case '>=':
                return fieldValue >= value;
            case '<=':
                return fieldValue <= value;
            default:
                return true;
        }
    };
    /**
     * Get column info for UI display
     */
    EnhancedSASReader.prototype.getColumnInfo = function (columnName) {
        return __awaiter(this, void 0, void 0, function () {
            var metadata, variable, uniqueValues, isNumeric, isCategorical;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getMetadata()];
                    case 1:
                        metadata = _a.sent();
                        variable = metadata.variables.find(function (v) { return v.name === columnName; });
                        if (!variable) {
                            throw new Error("Column '".concat(columnName, "' not found"));
                        }
                        return [4 /*yield*/, this.getUniqueValues(columnName)];
                    case 2:
                        uniqueValues = _a.sent();
                        isNumeric = variable.type === 'double' || variable.type === 'float' || variable.type === 'integer';
                        isCategorical = !isNumeric || (isNumeric && uniqueValues.length < 20);
                        return [2 /*return*/, {
                                name: columnName,
                                type: variable.type,
                                uniqueCount: uniqueValues.length,
                                sampleValues: uniqueValues.slice(0, 10),
                                isNumeric: isNumeric,
                                isCategorical: isCategorical
                            }];
                }
            });
        });
    };
    /**
     * Close and cleanup
     */
    EnhancedSASReader.prototype.dispose = function () {
        this.dataCache = null;
        this.metadata = null;
    };
    return EnhancedSASReader;
}());
exports.EnhancedSASReader = EnhancedSASReader;
