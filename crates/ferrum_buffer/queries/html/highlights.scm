; HTML highlights.scm

; Tags
(tag_name) @tag
(erroneous_end_tag_name) @error

; Attributes
(attribute_name) @property
(attribute_value) @string
(quoted_attribute_value) @string

; Text
(text) @string

; Doctype
(doctype) @keyword

; Comments
(comment) @comment

; Punctuation
["<" ">" "</" "/>"] @tag.delimiter
["="] @operator
