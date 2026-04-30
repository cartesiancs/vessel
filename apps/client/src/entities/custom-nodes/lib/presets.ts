export interface PresetConnector {
  id: string;
  name: string;
  type: "in" | "out";
}

export type PresetCategory =
  | "Math"
  | "String"
  | "Array"
  | "Random"
  | "Data Utility"
  | "Counter";

export interface RhaiPreset {
  nodeId: string;
  displayName: string;
  description: string;
  category: PresetCategory;
  connectors: PresetConnector[];
  scriptPath: string;
}

export function presetToApiPayload(preset: RhaiPreset) {
  return {
    node_type: preset.nodeId,
    data: {
      connectors: preset.connectors,
      data: { path: preset.scriptPath },
      dataType: { path: "FIXED_STRING" },
      nodeType: preset.nodeId,
    },
  };
}

export const RHAI_PRESETS: RhaiPreset[] = [
  // ============ Math ============
  {
    nodeId: "_math_abs",
    displayName: "Absolute Value",
    description: "Returns the absolute value of a number",
    category: "Math",
    connectors: [
      { id: "id", name: "number", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/math_abs.rhai",
  },
  {
    nodeId: "_math_clamp",
    displayName: "Clamp",
    description: "Clamps a number between min and max",
    category: "Math",
    connectors: [
      { id: "id", name: "number", type: "in" },
      { id: "id", name: "min", type: "in" },
      { id: "id", name: "max", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/math_clamp.rhai",
  },
  {
    nodeId: "_math_round",
    displayName: "Round",
    description: "Rounds a number to the nearest integer",
    category: "Math",
    connectors: [
      { id: "id", name: "number", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/math_round.rhai",
  },
  {
    nodeId: "_math_power",
    displayName: "Power",
    description: "Raises base to the power of exponent",
    category: "Math",
    connectors: [
      { id: "id", name: "base", type: "in" },
      { id: "id", name: "exponent", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/math_power.rhai",
  },
  {
    nodeId: "_math_sqrt",
    displayName: "Square Root",
    description: "Calculates the square root of a number",
    category: "Math",
    connectors: [
      { id: "id", name: "number", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/math_sqrt.rhai",
  },
  {
    nodeId: "_math_min",
    displayName: "Minimum",
    description: "Returns the smaller of two numbers",
    category: "Math",
    connectors: [
      { id: "id", name: "a", type: "in" },
      { id: "id", name: "b", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/math_min.rhai",
  },
  {
    nodeId: "_math_max",
    displayName: "Maximum",
    description: "Returns the larger of two numbers",
    category: "Math",
    connectors: [
      { id: "id", name: "a", type: "in" },
      { id: "id", name: "b", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/math_max.rhai",
  },
  {
    nodeId: "_math_map_range",
    displayName: "Map Range",
    description: "Maps a value from one range to another",
    category: "Math",
    connectors: [
      { id: "id", name: "value", type: "in" },
      { id: "id", name: "in_min", type: "in" },
      { id: "id", name: "in_max", type: "in" },
      { id: "id", name: "out_min", type: "in" },
      { id: "id", name: "out_max", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/math_map_range.rhai",
  },

  // ============ String ============
  {
    nodeId: "_string_concat",
    displayName: "Concatenate",
    description: "Joins two strings together",
    category: "String",
    connectors: [
      { id: "id", name: "a", type: "in" },
      { id: "id", name: "b", type: "in" },
      { id: "id", name: "string", type: "out" },
    ],
    scriptPath: "{:code}/string_concat.rhai",
  },
  {
    nodeId: "_string_upper",
    displayName: "To Uppercase",
    description: "Converts string to uppercase",
    category: "String",
    connectors: [
      { id: "id", name: "string", type: "in" },
      { id: "id", name: "string", type: "out" },
    ],
    scriptPath: "{:code}/string_upper.rhai",
  },
  {
    nodeId: "_string_lower",
    displayName: "To Lowercase",
    description: "Converts string to lowercase",
    category: "String",
    connectors: [
      { id: "id", name: "string", type: "in" },
      { id: "id", name: "string", type: "out" },
    ],
    scriptPath: "{:code}/string_lower.rhai",
  },
  {
    nodeId: "_string_trim",
    displayName: "Trim",
    description: "Removes whitespace from both ends",
    category: "String",
    connectors: [
      { id: "id", name: "string", type: "in" },
      { id: "id", name: "string", type: "out" },
    ],
    scriptPath: "{:code}/string_trim.rhai",
  },
  {
    nodeId: "_string_length",
    displayName: "String Length",
    description: "Returns the length of a string",
    category: "String",
    connectors: [
      { id: "id", name: "string", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/string_length.rhai",
  },
  {
    nodeId: "_string_contains",
    displayName: "Contains",
    description: "Checks if string contains a substring",
    category: "String",
    connectors: [
      { id: "id", name: "string", type: "in" },
      { id: "id", name: "search", type: "in" },
      { id: "id", name: "bool", type: "out" },
    ],
    scriptPath: "{:code}/string_contains.rhai",
  },
  {
    nodeId: "_string_replace",
    displayName: "Replace",
    description: "Replaces occurrences in a string",
    category: "String",
    connectors: [
      { id: "id", name: "string", type: "in" },
      { id: "id", name: "from", type: "in" },
      { id: "id", name: "to", type: "in" },
      { id: "id", name: "string", type: "out" },
    ],
    scriptPath: "{:code}/string_replace.rhai",
  },
  {
    nodeId: "_string_split",
    displayName: "Split",
    description: "Splits string by delimiter into array",
    category: "String",
    connectors: [
      { id: "id", name: "string", type: "in" },
      { id: "id", name: "delimiter", type: "in" },
      { id: "id", name: "array", type: "out" },
    ],
    scriptPath: "{:code}/string_split.rhai",
  },
  {
    nodeId: "_string_substring",
    displayName: "Substring",
    description: "Extracts a portion of a string",
    category: "String",
    connectors: [
      { id: "id", name: "string", type: "in" },
      { id: "id", name: "start", type: "in" },
      { id: "id", name: "length", type: "in" },
      { id: "id", name: "string", type: "out" },
    ],
    scriptPath: "{:code}/string_substring.rhai",
  },
  {
    nodeId: "_string_reverse",
    displayName: "Reverse String",
    description: "Reverses a string",
    category: "String",
    connectors: [
      { id: "id", name: "string", type: "in" },
      { id: "id", name: "string", type: "out" },
    ],
    scriptPath: "{:code}/string_reverse.rhai",
  },

  // ============ Array ============
  {
    nodeId: "_array_length",
    displayName: "Array Length",
    description: "Returns the length of an array",
    category: "Array",
    connectors: [
      { id: "id", name: "array", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/array_length.rhai",
  },
  {
    nodeId: "_array_push",
    displayName: "Array Push",
    description: "Appends an item to an array",
    category: "Array",
    connectors: [
      { id: "id", name: "array", type: "in" },
      { id: "id", name: "item", type: "in" },
      { id: "id", name: "array", type: "out" },
    ],
    scriptPath: "{:code}/array_push.rhai",
  },
  {
    nodeId: "_array_reverse",
    displayName: "Array Reverse",
    description: "Reverses an array in place",
    category: "Array",
    connectors: [
      { id: "id", name: "array", type: "in" },
      { id: "id", name: "array", type: "out" },
    ],
    scriptPath: "{:code}/array_reverse.rhai",
  },
  {
    nodeId: "_array_join",
    displayName: "Array Join",
    description: "Joins array elements into a string",
    category: "Array",
    connectors: [
      { id: "id", name: "array", type: "in" },
      { id: "id", name: "delimiter", type: "in" },
      { id: "id", name: "string", type: "out" },
    ],
    scriptPath: "{:code}/array_join.rhai",
  },
  {
    nodeId: "_array_sort",
    displayName: "Array Sort",
    description: "Sorts an array in ascending order",
    category: "Array",
    connectors: [
      { id: "id", name: "array", type: "in" },
      { id: "id", name: "array", type: "out" },
    ],
    scriptPath: "{:code}/array_sort.rhai",
  },
  {
    nodeId: "_array_sum",
    displayName: "Array Sum",
    description: "Sums all numeric elements in an array",
    category: "Array",
    connectors: [
      { id: "id", name: "array", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/array_sum.rhai",
  },
  {
    nodeId: "_array_average",
    displayName: "Array Average",
    description: "Calculates the average of array elements",
    category: "Array",
    connectors: [
      { id: "id", name: "array", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/array_average.rhai",
  },

  // ============ Random ============
  {
    nodeId: "_random_number",
    displayName: "Random Number",
    description: "Generates a random number (input + random float)",
    category: "Random",
    connectors: [{ id: "id", name: "number", type: "out" }],
    scriptPath: "{:code}/add_node.rhai",
  },
  {
    nodeId: "_random_range",
    displayName: "Random Range",
    description: "Generates random number within a range",
    category: "Random",
    connectors: [
      { id: "id", name: "min", type: "in" },
      { id: "id", name: "max", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/random_range.rhai",
  },
  {
    nodeId: "_random_bool",
    displayName: "Random Boolean",
    description: "Generates a random true/false value",
    category: "Random",
    connectors: [{ id: "id", name: "bool", type: "out" }],
    scriptPath: "{:code}/random_bool.rhai",
  },
  {
    nodeId: "_random_choice",
    displayName: "Random Choice",
    description: "Picks a random element from an array",
    category: "Random",
    connectors: [
      { id: "id", name: "array", type: "in" },
      { id: "id", name: "value", type: "out" },
    ],
    scriptPath: "{:code}/random_choice.rhai",
  },

  // ============ Data Utility ============
  {
    nodeId: "_passthrough",
    displayName: "Passthrough",
    description: "Passes input directly to output unchanged",
    category: "Data Utility",
    connectors: [
      { id: "id", name: "value", type: "in" },
      { id: "id", name: "value", type: "out" },
    ],
    scriptPath: "{:code}/passthrough.rhai",
  },
  {
    nodeId: "_timestamp",
    displayName: "Timestamp",
    description: "Outputs the current epoch timestamp in milliseconds",
    category: "Data Utility",
    connectors: [{ id: "id", name: "number", type: "out" }],
    scriptPath: "{:code}/timestamp.rhai",
  },
  {
    nodeId: "_template",
    displayName: "Template",
    description: "Replaces {value} placeholder in a template string",
    category: "Data Utility",
    connectors: [
      { id: "id", name: "template", type: "in" },
      { id: "id", name: "value", type: "in" },
      { id: "id", name: "string", type: "out" },
    ],
    scriptPath: "{:code}/template.rhai",
  },
  {
    nodeId: "_to_json_string",
    displayName: "To JSON String",
    description: "Converts a value to its string representation",
    category: "Data Utility",
    connectors: [
      { id: "id", name: "value", type: "in" },
      { id: "id", name: "string", type: "out" },
    ],
    scriptPath: "{:code}/to_json_string.rhai",
  },
  {
    nodeId: "_parse_json",
    displayName: "Parse JSON",
    description: "Parses a JSON string into an object",
    category: "Data Utility",
    connectors: [
      { id: "id", name: "string", type: "in" },
      { id: "id", name: "value", type: "out" },
    ],
    scriptPath: "{:code}/parse_json.rhai",
  },

  // ============ Counter ============
  {
    nodeId: "_counter",
    displayName: "Counter",
    description: "Increments current value by step",
    category: "Counter",
    connectors: [
      { id: "id", name: "current", type: "in" },
      { id: "id", name: "step", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/counter.rhai",
  },
  {
    nodeId: "_accumulator",
    displayName: "Accumulator",
    description: "Adds value to a running total",
    category: "Counter",
    connectors: [
      { id: "id", name: "total", type: "in" },
      { id: "id", name: "value", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    scriptPath: "{:code}/accumulator.rhai",
  },
];

export function getPresetCategories(): PresetCategory[] {
  const categories = new Set<PresetCategory>();
  for (const preset of RHAI_PRESETS) {
    categories.add(preset.category);
  }
  return Array.from(categories);
}

export function getPresetsByCategory(category: PresetCategory): RhaiPreset[] {
  return RHAI_PRESETS.filter((p) => p.category === category);
}
