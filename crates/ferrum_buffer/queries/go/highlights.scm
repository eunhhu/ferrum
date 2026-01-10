; Go highlights.scm

; Keywords
[
  "break"
  "case"
  "chan"
  "const"
  "continue"
  "default"
  "defer"
  "else"
  "fallthrough"
  "for"
  "func"
  "go"
  "goto"
  "if"
  "import"
  "interface"
  "map"
  "package"
  "range"
  "return"
  "select"
  "struct"
  "switch"
  "type"
  "var"
] @keyword

"return" @keyword.return
["if" "else" "switch" "case" "select"] @keyword.control
["for" "range"] @keyword.repeat
"func" @keyword.function

; Types
(type_identifier) @type
(type_spec name: (type_identifier) @type)

; Built-in types
((type_identifier) @type.builtin
  (#match? @type.builtin "^(bool|byte|complex64|complex128|error|float32|float64|int|int8|int16|int32|int64|rune|string|uint|uint8|uint16|uint32|uint64|uintptr)$"))

; Functions
(function_declaration name: (identifier) @function)
(method_declaration name: (field_identifier) @function.method)
(call_expression function: (identifier) @function)
(call_expression function: (selector_expression field: (field_identifier) @function.method))

; Built-in functions
((identifier) @function.builtin
  (#match? @function.builtin "^(append|cap|close|complex|copy|delete|imag|len|make|new|panic|print|println|real|recover)$"))

; Variables
(identifier) @variable
(field_identifier) @property
(parameter_declaration (identifier) @variable.parameter)

; Built-in constants
((identifier) @constant.builtin
  (#match? @constant.builtin "^(true|false|nil|iota)$"))

; Literals
(interpreted_string_literal) @string
(raw_string_literal) @string
(rune_literal) @string
(escape_sequence) @string.special
(int_literal) @number
(float_literal) @number
(imaginary_literal) @number

; Comments
(comment) @comment

; Operators
[
  "+"
  "-"
  "*"
  "/"
  "%"
  "&"
  "|"
  "^"
  "<<"
  ">>"
  "&^"
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
  "&^="
  "&&"
  "||"
  "<-"
  "++"
  "--"
  "=="
  "!="
  "<"
  "<="
  ">"
  ">="
  "="
  ":="
  "!"
  "..."
] @operator

; Punctuation
["(" ")" "[" "]" "{" "}"] @punctuation.bracket
["," ";" ":" "."] @punctuation.delimiter

; Package
(package_clause (package_identifier) @namespace)
(import_spec path: (interpreted_string_literal) @string)
