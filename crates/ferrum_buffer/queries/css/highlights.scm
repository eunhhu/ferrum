; CSS highlights.scm

; Selectors
(tag_name) @tag
(class_name) @type
(id_name) @constant
(attribute_name) @property
(pseudo_class_selector (class_name) @function)
(pseudo_element_selector (tag_name) @function)

; Properties
(property_name) @property

; Values
(plain_value) @string
(string_value) @string
(color_value) @string
(integer_value) @number
(float_value) @number

; Units
(unit) @type

; Functions
(function_name) @function

; Keywords
[
  "@media"
  "@import"
  "@charset"
  "@namespace"
  "@keyframes"
  "@supports"
  "@font-face"
] @keyword

; Important
(important) @keyword

; Comments
(comment) @comment

; Punctuation
["{" "}"] @punctuation.bracket
["(" ")"] @punctuation.bracket
["[" "]"] @punctuation.bracket
["," ":" ";"] @punctuation.delimiter

; Operators
[">" "+" "~" "*"] @operator
