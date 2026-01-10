; Rust highlights.scm

; Keywords
[
  "as"
  "async"
  "await"
  "break"
  "const"
  "continue"
  "crate"
  "dyn"
  "else"
  "enum"
  "extern"
  "fn"
  "for"
  "if"
  "impl"
  "in"
  "let"
  "loop"
  "macro_rules!"
  "match"
  "mod"
  "move"
  "mut"
  "pub"
  "ref"
  "return"
  "static"
  "struct"
  "trait"
  "type"
  "union"
  "unsafe"
  "use"
  "where"
  "while"
] @keyword

"return" @keyword.return
["if" "else" "match"] @keyword.control
["for" "while" "loop"] @keyword.repeat
"fn" @keyword.function

; Types
(type_identifier) @type
(primitive_type) @type.builtin
(self) @variable.builtin

; Functions
(function_item name: (identifier) @function)
(call_expression function: (identifier) @function)
(call_expression function: (field_expression field: (field_identifier) @function.method))
(macro_invocation macro: (identifier) @function.macro)

; Variables
(identifier) @variable
(field_identifier) @property
(parameter (identifier) @variable.parameter)

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
((line_comment) @comment.documentation
  (#match? @comment.documentation "^///"))
((line_comment) @comment.documentation
  (#match? @comment.documentation "^//!"))

; Attributes
(attribute_item) @attribute
(inner_attribute_item) @attribute

; Operators
[
  "+"
  "-"
  "*"
  "/"
  "%"
  "="
  "=="
  "!="
  "<"
  ">"
  "<="
  ">="
  "&&"
  "||"
  "!"
  "&"
  "|"
  "^"
  "~"
  "<<"
  ">>"
  "+="
  "-="
  "*="
  "/="
  "%="
  "&="
  "|="
  "^="
  "<<="
  ">>="
  ".."
  "..="
  "=>"
  "->"
  "::"
  "?"
] @operator

; Punctuation
["(" ")" "[" "]" "{" "}"] @punctuation.bracket
["," ";" ":" "."] @punctuation.delimiter

; Namespaces
(mod_item name: (identifier) @namespace)
(scoped_identifier path: (identifier) @namespace)
