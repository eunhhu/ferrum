; TOML highlights.scm

; Tables
(table (bare_key) @type)
(table (dotted_key) @type)
(array_table (bare_key) @type)
(array_table (dotted_key) @type)

; Keys
(pair (bare_key) @property)
(pair (dotted_key) @property)

; Values
(string) @string
(integer) @number
(float) @number
(boolean) @constant.builtin
(offset_date_time) @string
(local_date_time) @string
(local_date) @string
(local_time) @string

; Punctuation
["{" "}"] @punctuation.bracket
["[" "]"] @punctuation.bracket
["[[" "]]"] @punctuation.bracket
["," "." "="] @punctuation.delimiter

; Comments
(comment) @comment
