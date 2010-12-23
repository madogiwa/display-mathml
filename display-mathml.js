/*
 * Copyright (c) 2010 Hidenori Sugiyama
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

// namespace
(typeof mdgw != 'undefined') ? null : mdgw = {};
(typeof mdgw.mathml != 'undefined') ? null : mdgw.mathml = {};

// console
(typeof console != 'undefined') ? null : console = {};
(typeof console.log != 'undefined') ? null : console.log = function(msg){};

// enable/disable flag for onLoad handler
mdgw.mathml.autoExec = true;

/*
 * onLoad handler
 */
(function() {
    var handler = function() {
        if (!mdgw.mathml.autoExec) {
            return;
        }

        if (mdgw.mathml.hasNativeSupport()) {
            return;
        }

        var displayMathML = new mdgw.mathml.DisplayMathML();
        displayMathML.replaceAll(document);
    };

    if (window.addEventListener) {
        window.addEventListener('load', handler, false);
    } else {
        window.attachEvent('onload', handler);
    }
})();

/*
 * class DisplayMathML
 */
mdgw.mathml.DisplayMathML = function() {
};

/*
 *
 */
mdgw.mathml.DisplayMathML.prototype.replaceAll = function(doc) {
    var mathTags = this.scan(doc);
    for(var i = 0; i < mathTags.length; i++) {
        this.replace(mathTags[i]);
    }
};

/*
 *
 */
mdgw.mathml.DisplayMathML.prototype.replace = function(mathTag) {
    var target = mathTag.ownerDocument.createElement('div');

    mathTag.parentNode.insertBefore(target, mathTag);
    var doc = this.retrieve(mathTag);

    var renderer = new mdgw.mathml.MathMLRenderer();
    renderer.render(target, doc);
};

/*
 *
 */
mdgw.mathml.DisplayMathML.prototype.scan = function(doc) {
    var mathTags = [];
    mathTags.pushElements = function(list) {
        for (var i = 0; i < list.length; i++) {
            mathTags.push(list[i]);
        }
    };

    mathTags.pushElements(doc.getElementsByTagName('math'));
    if (typeof doc.getElementsByTagNameNS != 'undefined') {
        mathTags.pushElements(doc.getElementsByTagName('math'));
    }
    mathTags.pushElements(doc.getElementsByTagName('mml:math')); /* Microsoft Office */

    return mathTags;
};

/*
 *
 */
mdgw.mathml.DisplayMathML.prototype.retrieve = function(mathTag) {
    var xml = this.retrieveXML(mathTag);
    var doc = this.loadFromXML(xml);
    return doc;
};

/*
 *
 */
mdgw.mathml.DisplayMathML.prototype.retrieveXML = function(mathTag) {
    var xml = null;

    var browserInfo = mdgw.mathml.getBrowserInfo();
    if (browserInfo.type == 'msie') {
        var html = mathTag.outerHTML;
        if (html.match(/^\<\?xml:namespace prefix = [a-z0-9]*.*\/\>/i, '') ||
            html.match(/^\<([a-zA-Z0-9.]+\:)?math/)) {

            console.log('retrieve method: MSIE with XML');
            xml = this.retrieveXMLForMSIEWithXML(mathTag, html);
        } else {
            console.log('retrieve method: MSIE');
            xml = this.retrieveXMLForMSIE(mathTag);
        }

        xml = xml.replace(/\&nbsp\;/, '').replace(/\&amp\;([a-zA-Z]+)\;/g, function(whole, g1) {
            var unicode = mdgw.mathml.Entities[g1];
            return (unicode) ? unicode : g1;
        });
    } else if (typeof XMLSerializer != 'undefined') {
        console.log('retrieve method: Modern Browser');
        xml = this.retrieveXMLForModernBrowser(mathTag);
    } else {
        throw new Error('unsupported browser');
    }

    return xml;
};

mdgw.mathml.DisplayMathML.prototype.retrieveXMLForModernBrowser = function(mathTag) {
    var serializer = new XMLSerializer();
    xml = serializer.serializeToString(mathTag);
    console.log(xml);

    var dummy = mathTag.ownerDocument.createElement('div');
    dummy.appendChild(mathTag);

    xml = xml.replace(/\&([a-zA-Z]+)\;/g, function(whole, g1) {
        var unicode = mdgw.mathml.Entities[g1];
        return (unicode) ? unicode : g1;
    });

    return xml;
};

mdgw.mathml.DisplayMathML.prototype.retrieveXMLForMSIE = function(mathTag) {
    var xml = '';

    var match = mathTag.tagName.match(/([A-Z0-9]+)\:MATH/);
    var namespace = (match && match.length == 2) ? match[1] : '';
    var terminator = (namespace) ? '/' + namespace + ':' + 'MATH' : '/MATH';

    var dummy = mathTag.ownerDocument.createElement('div');
    var node = mathTag;
    do {
        if (node.nodeType == 1) {
            console.log(node.tagName + ':' + node.outerHTML);
            xml += node.outerHTML.toLowerCase();
        } else {
            console.log(node.tagName + ':' + node.tagValue);
            xml += node.nodeValue;
        }
        var next = node.nextSibling;
        dummy.appendChild(node);
        node = next;
    } while (node && node.tagName != terminator);

    if (node) {
        dummy.appendChild(node);
    }

    xml += '<' + terminator.toLowerCase() + '>';
    xml = xml.replace(/^\<\?xml:namespace prefix = [a-z0-9]*.*\/\>/i, '');
    console.log('xml:' + xml);

    return xml;
};

mdgw.mathml.DisplayMathML.prototype.retrieveXMLForMSIEWithXML = function(mathTag, html) {
    var xml = html.replace(/^\<\?xml:namespace prefix = [a-z0-9]*.*\/\>/i, '');
    console.log('xml:' + xml);

    var dummy = mathTag.ownerDocument.createElement('div');
    dummy.appendChild(mathTag);

    return xml;
};

/*
 *
 */
mdgw.mathml.DisplayMathML.prototype.loadFromXML = function(xml) {
    var doc = null;
    if (typeof ActiveXObject != "undefined") {
        doc = new ActiveXObject("MSXML2.DomDocument.3.0");
        doc.async = false;
        doc.loadXML(xml);
        if (doc.parseError.errorCode != 0) {
            throw new Error('parse error:' + doc.parseError.reason);
        }
    } else {
        var parser = new DOMParser();
        parser.async = false;
        doc = parser.parseFromString(xml, 'text/xml');
        if (doc.documentElement.nodeName=="parsererror") {
            throw new Error('parse error:' + doc.documentElement.childNodes[0].nodeValue);
        }
    }
    return doc;
};



/*
 * class MathMLRenderer
 */
mdgw.mathml.MathMLRenderer = function() {
    this._handlers = [];
};

/*
 *
 */
mdgw.mathml.MathMLRenderer.prototype.render = function(target, doc) {
    var root = doc.documentElement;
    console.log(root.attributes);

    var display = 'inline';
    if (root.getAttribute('mode') != null) {
        display = (root.getAttribute('mode') == 'display') ? 'block' : 'inline';
    } else if (root.getAttribute('display') != null) {
        display = root.getAttribute('display');
    }
    target.className = 'math math-' + display;

    this._recursive(target, doc.childNodes[0]);

    var self = this;
    setTimeout(function() {
        self.resize();
    }, 100);
};

/*
 *
 */
mdgw.mathml.MathMLRenderer.prototype.resize = function() {
    for (var i = 0; i < this._handlers.length; i++) {
        this._handlers[i].update();
    }
};

/*
 *
 */
mdgw.mathml.MathMLRenderer.prototype._recursive = function(target, node) {
    if (!node) {
        return;
    }

    var children = node.childNodes;
    console.log('recursive:' + node.tagName);

    for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.nodeType !== 1) {
            continue;
        }

       this._handle(target, child);
    }
};

/*
 *
 */
mdgw.mathml.MathMLRenderer.prototype._handle = function(target, child) {
    if (!child) {
        return;
    }

    var tagName = child.tagName.toLowerCase();
    console.log('handle:' + tagName);

    // remove namespace prefix
    tagName = tagName.replace(/^[a-zA-Z0-9]+:/, '');

    switch(tagName) {
      case 'mo':
        var fragment = null;
        var text = (typeof child.text != 'undefined') ? child.text : child.textContent;
        text = text.replace(/(^\s+)|(\s+$)/g, "");
        text = text.replace(/\u2061/g, ""); // Function Application (for IE)
        if (text.match(/([()\[\]]|\u222e|\u03a3|\u2211|\u222b)/)) {
            fragment = mdgw.mathml.createElement('span', tagName, target);
        } else {
            fragment = mdgw.mathml.createElement('span', tagName, target);
        }

        if (typeof fragment.textContent != 'undefined') {
            fragment.textContent = text;
        } else {
            fragment.innerText = text;
        }
        break;
      case 'mi':
      case 'mn':
      case 'mtext':
      case 'mspace':
      case 'ms':
        var fragment = mdgw.mathml.createElement('span', tagName, target);
        var text = (typeof child.text != 'undefined') ? child.text : child.textContent;
        text = text.replace(/(^\s+)|(\s+$)/g, "");
        text = text.replace(/\u2061/g, ""); // Function Application (for IE)
        if (typeof fragment.textContent != 'undefined') {
            fragment.textContent = text;
        } else {
            fragment.innerText = text;
        }
        break;
      case 'msglyph':
        var fragment = mdgw.mathml.createElement('div', tagName, target);
        if (typeof fragment.textContent != 'undefined') {
            fragment.textContent = child.getAttribute('alt');
        } else {
            fragment.innerText = child.getAttribute('alt');
        }
        break;
      case 'mstyle':
        var fragment = mdgw.mathml.createElement('div', 'mstyle', target);
        this._recursive(fragment, child);
        break;
      case 'mrow':
        var fragment = mdgw.mathml.createElement('div', 'mrow', target);
        this._recursive(fragment, child);
        break;
      case 'mfrac':
        var fragment = mdgw.mathml.createElement('div', 'mfrac', target);
        var numerator = mdgw.mathml.createElement('div', 'mfrac-numerator', fragment);
        var denominator = mdgw.mathml.createElement('div', 'mfrac-denominator', fragment);

        var linethickness = child.getAttribute('linethickness');
        if (linethickness) {
            numerator.style.borderBottom = linethickness + ' solid #000';
            denominator.style.borderTop = linethickness + ' solid #000';
        }

        var children = mdgw.mathml.childElements(child, 2);
        this._handle(numerator, children[0]);
        this._handle(denominator, children[1]);

        //this._handlers.push(new mdgw.mathml.SameHeightHandler(numerator, denominator));

        break;
      case 'msqrt':
        var fragment = mdgw.mathml.createElement('div', 'msqrt', target);

        var root = mdgw.mathml.createElement('div', 'msqrt-root', fragment);
        if (typeof root.textContent != 'undefined') {
            root.textContent = '√';
        } else {
            root.innerText = '√';
        }

        var base = mdgw.mathml.createElement('div', 'msqrt-base', fragment);
        this._recursive(base, child);

        this._handlers.push(new mdgw.mathml.StretchHandler(base, root));

        break;
      case 'mroot':
        var fragment = mdgw.mathml.createElement('div', 'mroot', target);
        var symbol = mdgw.mathml.createElement('div', 'mroot-symbol', fragment);

        var index = mdgw.mathml.createElement('div', 'mroot-index', symbol);
        var root = mdgw.mathml.createElement('div', 'mroot-root', symbol);

        if (typeof root.textContent != 'undefined') {
            root.textContent = '√';
        } else {
            root.innerText = '√';
        }

        var base = mdgw.mathml.createElement('div', 'mroot-base', fragment);
        var children = mdgw.mathml.childElements(child, 2);
        this._handle(base, children[0]);
        this._handle(index, children[1]);

        this._handlers.push(new mdgw.mathml.StretchHandler(base, root));

        break;
      case 'mfenced':
        var fragment = mdgw.mathml.createElement('div', 'mfenced', target);
        var open = mdgw.mathml.createElement('div', 'mfenced-open', fragment);
        var list = mdgw.mathml.createElement('div', 'mfenced-list', fragment);
        var children = mdgw.mathml.childElements(child);
        for (var i = 0; i < children.length; i++) {
            var scala = mdgw.mathml.createElement('div', 'mfenced-scala', list);
            this._handle(scala, children[i]);

            if (i != (children.length - 1)) {
                var separator = mdgw.mathml.createElement('span', 'mfenced-separator', list);
                if (typeof fragment.textContent != 'undefined') {
                    separator.textContent = ',';
                } else {
                    separator.innerText = ',';
                }
            }
        }
        var close = mdgw.mathml.createElement('div', 'mfenced-close', fragment);

        if (typeof fragment.textContent != 'undefined') {
            open.textContent = '(';
            close.textContent = ')';
        } else {
            open.innerText = '(';
            close.innerText = ')';
        }

        this._handlers.push(new mdgw.mathml.StretchHandler(list, open));
        this._handlers.push(new mdgw.mathml.StretchHandler(list, close));

        break;
      case 'msup':
        var children = mdgw.mathml.childElements(child, 2);
        var node = mdgw.mathml.createElement('div', 'msup', target);
        var base = mdgw.mathml.createElement('div', 'msup-base', node);
        this._handle(base, children[0]);

        var superscript = mdgw.mathml.createElement('div', 'msup-superscript', node);
        this._handle(superscript, children[1]);

        break;
      case 'msub':
        var children = mdgw.mathml.childElements(child, 2);

        var node = mdgw.mathml.createElement('div', 'msub', target);
        var base = mdgw.mathml.createElement('div', 'msub-base', node);
        this._handle(base, children[0]);

        var subscript = mdgw.mathml.createElement('div', 'msub-subscript', node);
        this._handle(subscript, children[1]);

        break; 
      case 'msubsup':
        var fragment = mdgw.mathml.createElement('div', 'msubsup', target);
        var base = mdgw.mathml.createElement('div', 'msubsup-base', fragment);

        var table = mdgw.mathml.createElement('table', '', fragment);
        var tbody = mdgw.mathml.createElement('tbody', '', table);
        var tr1 = mdgw.mathml.createElement('tr', '', tbody);
        var superscript = mdgw.mathml.createElement('td', 'msubsup-superscript', tr1);
        var tr2 = mdgw.mathml.createElement('tr', '', tbody);
        var subscript = mdgw.mathml.createElement('td', 'msubsup-subscript', tr2);

        var children = mdgw.mathml.childElements(child, 3);
        this._handle(base, children[0]);
        this._handle(subscript, children[1]);
        this._handle(superscript, children[2]);
        break;
      case 'mover':
        var fragment = mdgw.mathml.createElement('div', 'mover', target);
        var overscript = mdgw.mathml.createElement('div', 'mover-overscript', fragment);
        var base = mdgw.mathml.createElement('div', 'mover-base', fragment);

        var children = mdgw.mathml.childElements(child, 2);
        this._handle(base, children[0]);
        this._handle(overscript, children[1]);
        break;
      case 'munder':
        var fragment = mdgw.mathml.createElement('div', 'munder', target);
        var base = mdgw.mathml.createElement('div', 'munder-base', fragment);
        var underscript = mdgw.mathml.createElement('div', 'munder-underscript', fragment);

        var children = mdgw.mathml.childElements(child, 2);
        this._handle(base, children[0]);
        this._handle(underscript, children[1]);
        break;
      case 'munderover':
        var fragment = mdgw.mathml.createElement('div', 'munderover', target);
        var overscript = mdgw.mathml.createElement('div', 'munderover-overscript', fragment);
        var base = mdgw.mathml.createElement('div', 'munderover-base', fragment);
        var underscript = mdgw.mathml.createElement('div', 'munderover-underscript', fragment);

        var children = mdgw.mathml.childElements(child, 3);
        this._handle(base, children[0]);
        this._handle(underscript, children[1]);
        this._handle(overscript, children[2]);
        break;
      case 'mmultiscripts':
        var fragment = mdgw.mathml.createElement('div', 'mmultiscripts', target);
        
        var base = mdgw.mathml.createElement('div', 'mmultiscripts-base', target);

        var script = mdgw.mathml.createElement('div', 'mmultiscripts-script', target);
        var prescript = mdgw.mathml.createElement('div', 'mmultiscripts-prescript', target);

        var children = mdgw.mathml.childElements(child);
        this._handle(base, children[0]);

        var i = 1;
        for (; i < children.length; i++) {
            if (children[i].nodeName == 'mprescripts') {
                i++;
                break;
            }
        }

        // prescripts
        for (; i < children.length; i++) {
        }

        break;
      case 'mtable':
        var fragment = mdgw.mathml.createElement('div', 'mtable', target);

        var table = mdgw.mathml.createElement('table', '', fragment);
        var tbody = mdgw.mathml.createElement('tbody', '', table);

        this._recursive(tbody, child);
        break;
      case 'mtr':
        var fragment = mdgw.mathml.createElement('tr', 'mtr', target);
        this._recursive(fragment, child);
        break;
      case 'mlabeledtr':
        var fragment = mdgw.mathml.createElement('tr', 'mlabeledtr', target);
        this._recursive(fragment, child);
        break;
      case 'mtd':
        var fragment = mdgw.mathml.createElement('td', 'mtd', target);
        this._recursive(fragment, child);
        break;
      default:
        target.appendChild(child.cloneNode(true));
        break;
    }
};


/*
 * ResizeHandler
 */
mdgw.mathml.ResizeHandler = function() {
};

/*
 *
 */
mdgw.mathml.ResizeHandler.prototype.getHeight = function(node) {
    var browserInfo = mdgw.mathml.getBrowserInfo();
    if (browserInfo.type == 'msie') {
       return node.offsetHeight;
    } else {
       return node.clientHeight;
    }
};

/*
 *
 */
mdgw.mathml.ResizeHandler.prototype.setHeight = function(node, height) {
    console.log(height);
    node.style.height = height;
};

/*
 * SameHeightHandler
 */
mdgw.mathml.SameHeightHandler = function() {
    Array.prototype.push.apply(this._targets, args);
};

/*
 *
 */
mdgw.mathml.SameHeightHandler.prototype = new mdgw.mathml.ResizeHandler();

/*
 *
 */
mdgw.mathml.SameHeightHandler.prototype.update = function() {
    var maxHeight = 0;

    for (var i = 0; i < this._targets.length; i++) {
        var height = getHeight(this._targets[i]);
        if (height > maxHeight) {
            maxHeight = height;
        }
    }

    for (var i = 0; i < this._targets.length; i++) {
        setHeight(this._targets[i], maxHeight);
    } 
};

/*
 * StretchHandler
 */
mdgw.mathml.StretchHandler = function(reference, target) {
    this._reference = reference;
    this._target = target;
};

/*
 *
 */
mdgw.mathml.StretchHandler.prototype = new mdgw.mathml.ResizeHandler();

/*
 *
 */
mdgw.mathml.StretchHandler.prototype.update = function() {
    var height = this.getHeight(this._reference);
    this.stretch(this._target, height);

    var browserInfo = mdgw.mathml.getBrowserInfo();
    if ((browserInfo.type == 'msie' && browserInfo.engine >= 8) ||
        (browserInfo.type != 'opera')) {
        // avoid setHeight bug
    } else {
        this.setHeight(this._target, height);
    }
};

/*
 *
 */
mdgw.mathml.StretchHandler.prototype.stretch = function(node, height) {
    var currentHeight = this.getHeight(node);
    var scale = height / currentHeight;
    var offsetY = 0;

    var info = mdgw.mathml.getBrowserInfo();
    if (info.type == 'msie') {
        console.log('height:' + height + ' current: ' + currentHeight + ' -' + (height - currentHeight) / 2);
        node.style.position = 'relative';
        offsetY = (-(height - currentHeight) / 2);
        if (info.engine < 8.0) {
            offsetY = -offsetY;
        }
        node.style.top =  offsetY + 'px';

        node.style.filter = "progid:DXImageTransform.Microsoft.Matrix(dz=1.0, dy=20, sizingMethod='auto expand', M11=1, M12=0, M21=0, M22=" + scale + ")";
        node.style.MsFilter = "progid:DXImageTransform.Microsoft.Matrix(sizingMethod='auto expand', M11=1, M12=0, M21=0, M22=" + scale + ")";
    } else {
        node.style.setProperty('transform', 'scale(1, ' + scale + ') translateY(' + offsetY + 'px)', null);
        node.style.setProperty('-moz-transform', 'scale(1, ' + scale + ') translateY(' + offsetY + 'px)', null);
        node.style.setProperty('-webkit-transform', 'scale(1, ' + scale + ') translateY(' + offsetY + 'px)', null);
        node.style.setProperty('-o-transform', 'scale(1, ' + scale + ') translateY(' + offsetY + 'px)', null);
    }
};


/*
 * @param msg log message.
 */
mdgw.mathml.log = function(msg) {
    if (typeof console != 'undefined') {
        console.log(msg);
    }
};

/*
 *
 */
mdgw.mathml.getBrowserInfo = function() {
    var info = {};

    var userAgent = navigator.userAgent;
    if (userAgent.match(/MSIE ([0-9]+\.[0-9]+)/)) {
        info.type = 'msie';
        info.version = parseFloat(RegExp.$1);

        if (document.documentMode) {
            info.engine = document.documentMode;
        } else if (document.compatMode && document.compatMode == "CSS1Compat") {
            info.engine = 7;
        } else {
            info.engine = 6;
        }
    } else if (userAgent.match(/AppleWebKit\/([0-9]+\.[0-9]+)/)) {
        info.type = 'webkit';
        info.version = parseFloat(RegExp.$1);
    } else if (userAgent.match(/Gecko\/([0-9]+)/)) {
        info.type = 'mozilla';
        info.version = parseFloat(RegExp.$1);
    } else if (userAgent.match(/Presto\/([0-9]+\.[0-9]+(\.[0-9]+)?)/)) {
        info.type = 'opera';
        info.version = parseFloat(RegExp.$1);
    } else {
        info.type = 'unknown';
        info.version = 1.0;
    }

    return info;
};

/*
 *
 */
mdgw.mathml.createElement = function(tagName, classes, parent) {
    var node = parent.ownerDocument.createElement(tagName);
    if (classes) {
        node.className = classes;
    }
    if (parent) {
        parent.appendChild(node);
    }
    return node;
};

/*
 *
 */
mdgw.mathml.childElements = function(node, length) {
    var elements = [];
    for(var i = 0; i < node.childNodes.length; i++) {
        var child = node.childNodes[i];
        if (child.nodeType != 1) {
            continue;
        }
        elements.push(child);
    }

    if (length && elements.length != length) {
        throw new Error('');
    }
    return elements;
};

/*
 *
 */
mdgw.mathml.hasNativeSupport = function() {
    var browserInfo = mdgw.mathml.getBrowserInfo();
/*
    if (browserInfo.type == 'opera') {
        // what version has native support?
        return true;
    }
*/
    return false;
};

mdgw.mathml.Entities = {
    /* Non Marking */
    'Tab':                   '\u0009',
    'NewLine':               '\u000A',
    'IndentingNewLine':      '\uE891',
    'NoBreak':               '\uE892',
    'GoodBreak':             '\uE893',
    'BadBreak':              '\uE894',
    'Space':                 '\u0020',
    'NonBreakingSpace':      '\u00A0',
    'ZeroWidthSpace':        '\u200B',
    'VeryThinSpace':         '\u200A',
    'ThinSpace':             '\u2009',
    'MediumSpace':           '\u2005',
    'ThickSpace':            '\uE897',
    'NegativeVeryThinSpace': '\uE898',
    'NegativeThinSpace':     '\uE899',
    'NegativeMediumSpace':   '\uE89A',
    'NegativeThickSpace':    '\uE89B',
    'InvisibleComma':        '', // \uE89C
    'ic':                    '', // \uE89C
    'InvisibleTimes':        '', // \uE89E
    'it;':                   '', // \uE89E
    'ApplyFunction':         '', // \uE8A0
    'af':                    '', // \uE8A0
    /* Special Constants */
    'CapitalDifferentialD':  '\uF74B',
    'DD':                    '\uF74B',
    'DifferentialD':         '\uF74C',
    'dd':                    '\uF74C',
    'ExponentialE':          '\uF74D',
    'ee':                    '\uF74D',
    'false':                 '\uE8A7',
    'ImaginaryI':            '\uF74E',
    'ii':                    '\uF74E',
    'NotANumber':            '\uE8AA',
    'true':                  '\uE8AB',
    /* Additional */
    'LeftSkeleton':'\uE850',
    'RightSkeleton':'\uE851',
    'LeftBracketingBar':'\uF603',
    'RightBracketingBar':'\uE604',
    'LeftDoubleBracketingBar':'\uF605',
    'RightDoubleBracketingBar':'\uF606',
    'HorizontalLine':'\uE859',
    'VerticalLine':'\uE85A',
    'Assign':'\uE85B',
    'VerticalSeparator':'\uE85C',
    'DoubleLeftTee':'\uE30F',
    'RoundImplies':'\uF524',
    'NotSquareSubset':'\uE604',
    'NotSquareSuperset':'\uE615',
    'NotSubsetEqual':'\u2288',
    'NotSupersetEqual':'\u2289',
    'DownLeftRightVector':'\uF50B',
    'DownLeftTeeVector':'\uF50E',
    'DownLeftVectorBar':'\uF50C',
    'DownRightTeeVector':'\uF50F',
    'DownRightVectorBar':'\uF50D',
    'LeftArrowBar':'\u21E4',
    'LeftRightVector':'\uF505',
    'LeftTeeArrow':'\u21A4',
    'LeftTeeVector':'\uF509',
    'LeftVectorBar':'\uF507',
    'RightArrowBar':'\u21E5',
    'RightTeeVector':'\uF50A',
    'RightVectorBar':'\uF508',
    'Equal':'\uF431',
    'GreaterGreater':'\uE2F7',
    'LeftTriangleBar':'\uF410',
    'LessLess':'\uE2FB',
    'NotCupCap':'\u226D',
    'NotEqualTilde':'\uE84E',
    'NotHumpDownHump':'\uE616',
    'NotHumpEqual':'\uE84D',
    'NotLeftTriangleBar':'\uF412',
    'NotNestedGreaterGreater':'\uF428',
    'NotNestedLessLess':'\uF423',
    'NotPrecedesTilde':'\uE5DC',
    'NotRightTriangleBar':'\uE870',
    'NotSucceedsTilde':'\uE837',
    'RightTriangleBar':'\uF411',
    'Product':'\u220F',
    'Diamond':'\u22C4',
    'Cross':'\uE619',
    'Square':'\u25A1',
    'DownArrowBar':'\uF504',
    'DownTeeArrow':'\u21A7',
    'LeftDownTeeVector':'\uF519',
    'LeftDownVectorBar':'\uF517',
    'LeftUpDownVector':'\uF515',
    'LeftUpTeeVector':'\uF518',
    'LeftUpVectorBar':'\uF516',
    'RightDownTeeVector':'\uF514',
    'RightDownVectorBar':'\uF512',
    'RightUpDownVector':'\uF510',
    'RightUpTeeVector':'\uF513',
    'RightUpVectorBar':'\uF511',
    'ShortDownArrow':'\uE87F',
    'ShortUpArrow':'\uE880',
    'UpArrowBar':'\uF503',
    'UpTeeArrow':'\u21A5',
    'DownBreve':'\u0311',
    'OverBar':'\u00AF',
    'OverBrace':'\uF612',
    'OverBracket':'\uF614',
    'OverParenthesis':'\uF610',
    'UnderBar':'\u0332',
    'UnderBrace':'\uF613',
    'UnderBracket':'\uF615',
    'UnderParenthesis':'\uF611',
    'EmptyVerySmallSquare':'\uF530',
    'FilledVerySmallSquare':'\uF529',
    'EmptySmallSquare':'\uF527',
    'FilledSmallSquare':'\uF528',
    'RuleDelayed':'\uF51F',

    /* Other */
    'PlusMinus': '\u00B1',
    'nbsp': ' '
};
