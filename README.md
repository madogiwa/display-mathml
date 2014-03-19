display-mathml-amd
==================

This is a simple display engine for MathML(Presentation Markup).

init with Requirejs:

```javascript
var DMML = require('display-mathml-amd');
var displayMathML = new DMML.displayMathml();
```
replace all elements in document:

```javascript
displayMathML.replaceAll(document);
```
