; Markdown highlights.scm

; Headings
(atx_heading (atx_h1_marker) @keyword)
(atx_heading (atx_h2_marker) @keyword)
(atx_heading (atx_h3_marker) @keyword)
(atx_heading (atx_h4_marker) @keyword)
(atx_heading (atx_h5_marker) @keyword)
(atx_heading (atx_h6_marker) @keyword)
(setext_heading) @keyword

; Inline elements
(emphasis) @string
(strong_emphasis) @string
(strikethrough) @string

; Code
(code_span) @string
(fenced_code_block) @embedded
(indented_code_block) @embedded
(info_string) @property

; Links
(link_text) @string
(link_destination) @string
(link_title) @string
(image) @string

; Lists
(list_marker_minus) @punctuation
(list_marker_plus) @punctuation
(list_marker_star) @punctuation
(list_marker_dot) @punctuation
(list_marker_parenthesis) @punctuation

; Block quotes
(block_quote_marker) @punctuation

; Thematic breaks
(thematic_break) @punctuation

; HTML
(html_block) @embedded
