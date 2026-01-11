; Rust highlights.scm - Compatible with tree-sitter-rust 0.23

; Types
(type_identifier) @type
(primitive_type) @type.builtin

; Functions
(function_item name: (identifier) @function)
(call_expression function: (identifier) @function)
(call_expression function: (field_expression field: (field_identifier) @function.method))
(macro_invocation macro: (identifier) @function.macro)

; Variables
(identifier) @variable
(field_identifier) @property

; Literals
(string_literal) @string
(raw_string_literal) @string
(char_literal) @string
(escape_sequence) @string.special
(integer_literal) @number
(float_literal) @number
(boolean_literal) @constant.builtin

; Comments
(line_comment) @comment
(block_comment) @comment

; Attributes
(attribute_item) @attribute
(inner_attribute_item) @attribute

; Punctuation
["(" ")" "[" "]" "{" "}"] @punctuation.bracket
["," ";" ":" "."] @punctuation.delimiter

; Namespaces
(mod_item name: (identifier) @namespace)
(scoped_identifier path: (identifier) @namespace)

; Self
(self) @variable.builtin
