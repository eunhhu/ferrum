; Python highlights.scm

; Keywords
[
  "and"
  "as"
  "assert"
  "async"
  "await"
  "break"
  "class"
  "continue"
  "def"
  "del"
  "elif"
  "else"
  "except"
  "exec"
  "finally"
  "for"
  "from"
  "global"
  "if"
  "import"
  "in"
  "is"
  "lambda"
  "nonlocal"
  "not"
  "or"
  "pass"
  "print"
  "raise"
  "return"
  "try"
  "while"
  "with"
  "yield"
  "match"
  "case"
] @keyword

"return" @keyword.return
["if" "elif" "else" "match" "case"] @keyword.control
["for" "while"] @keyword.repeat
"def" @keyword.function

; Functions
(function_definition name: (identifier) @function)
(call function: (identifier) @function)
(call function: (attribute attribute: (identifier) @function.method))
(decorator) @attribute

; Built-in functions
((call function: (identifier) @function.builtin)
  (#match? @function.builtin "^(abs|all|any|ascii|bin|bool|breakpoint|bytearray|bytes|callable|chr|classmethod|compile|complex|delattr|dict|dir|divmod|enumerate|eval|exec|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|isinstance|issubclass|iter|len|list|locals|map|max|memoryview|min|next|object|oct|open|ord|pow|print|property|range|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|vars|zip|__import__)$"))

; Classes
(class_definition name: (identifier) @type)

; Variables
(identifier) @variable
(attribute attribute: (identifier) @property)
(parameters (identifier) @variable.parameter)
(default_parameter name: (identifier) @variable.parameter)
(typed_parameter (identifier) @variable.parameter)
(keyword_argument name: (identifier) @variable.parameter)

; Types (annotations)
(type (identifier) @type)

; Built-in types
((identifier) @type.builtin
  (#match? @type.builtin "^(bool|bytes|dict|float|frozenset|int|list|object|set|str|tuple|type)$"))

; Literals
(string) @string
(escape_sequence) @string.special
(integer) @number
(float) @number
(true) @constant.builtin
(false) @constant.builtin
(none) @constant.builtin

; Comments
(comment) @comment

; Operators
[
  "+"
  "-"
  "*"
  "**"
  "/"
  "//"
  "%"
  "@"
  "|"
  "&"
  "^"
  "~"
  "<<"
  ">>"
  "<"
  ">"
  "<="
  ">="
  "=="
  "!="
  ":="
] @operator

; Punctuation
["(" ")" "[" "]" "{" "}"] @punctuation.bracket
["," ":" "."] @punctuation.delimiter

; Self
(self) @variable.builtin
