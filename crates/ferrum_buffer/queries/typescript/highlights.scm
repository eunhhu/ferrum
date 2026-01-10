; TypeScript/JavaScript highlights.scm

; Keywords
[
  "async"
  "await"
  "break"
  "case"
  "catch"
  "class"
  "const"
  "continue"
  "debugger"
  "default"
  "delete"
  "do"
  "else"
  "export"
  "extends"
  "finally"
  "for"
  "from"
  "function"
  "get"
  "if"
  "import"
  "in"
  "instanceof"
  "let"
  "new"
  "of"
  "return"
  "set"
  "static"
  "switch"
  "throw"
  "try"
  "typeof"
  "var"
  "void"
  "while"
  "with"
  "yield"
] @keyword

; TypeScript specific
[
  "abstract"
  "as"
  "declare"
  "enum"
  "implements"
  "interface"
  "keyof"
  "namespace"
  "private"
  "protected"
  "public"
  "readonly"
  "type"
] @keyword

"return" @keyword.return
["if" "else" "switch" "case"] @keyword.control
["for" "while" "do"] @keyword.repeat
"function" @keyword.function

; Types
(type_identifier) @type
(predefined_type) @type.builtin

; Functions
(function_declaration name: (identifier) @function)
(method_definition name: (property_identifier) @function.method)
(call_expression function: (identifier) @function)
(call_expression function: (member_expression property: (property_identifier) @function.method))
(arrow_function) @function

; Variables
(identifier) @variable
(property_identifier) @property
(shorthand_property_identifier) @property
(required_parameter (identifier) @variable.parameter)
(optional_parameter (identifier) @variable.parameter)

; Literals
(string) @string
(template_string) @string
(template_substitution) @embedded
(escape_sequence) @string.special
(number) @number
(true) @constant.builtin
(false) @constant.builtin
(null) @constant.builtin
(undefined) @constant.builtin

; Comments
(comment) @comment

; Operators
[
  "+"
  "-"
  "*"
  "/"
  "%"
  "**"
  "="
  "+="
  "-="
  "*="
  "/="
  "%="
  "**="
  "=="
  "==="
  "!="
  "!=="
  "<"
  ">"
  "<="
  ">="
  "&&"
  "||"
  "??"
  "!"
  "~"
  "&"
  "|"
  "^"
  "<<"
  ">>"
  ">>>"
  "=>"
  "?."
  "?:"
  "..."
] @operator

; Punctuation
["(" ")" "[" "]" "{" "}"] @punctuation.bracket
["," ";" ":" "."] @punctuation.delimiter

; JSX/TSX
(jsx_element) @tag
(jsx_opening_element name: (identifier) @tag)
(jsx_closing_element name: (identifier) @tag)
(jsx_self_closing_element name: (identifier) @tag)
(jsx_attribute (property_identifier) @property)
["<" ">" "</" "/>"] @tag.delimiter
