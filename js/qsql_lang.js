CodeMirror.defineSimpleMode("simplemode", {
  // The start state contains the rules that are intially used
  start: [
    // The regex matches the token, the token property contains the type
    {regex: /"(?:[^\\]|\\.)*?(?:"|$)/, token: "string"},
    // You can match multiple tokens at once. Note that the captured
    // groups must span the whole string in this case
    {regex: /(function)(\s+)([a-z$][\w$]*)/,
     token: ["keyword", null, "variable-2"]},
    // Rules are matched in the order in which they appear, so there is
    // no ambiguity between this one and the one above
    {regex: /(?:view|num|integer|and|\/insert|\/array|\/lower|\/nn|\/check|\/fk|\/constant|\/upper|\/indexed|\/default|\/between|\/rowversion|\/auditcols)\b/,
     token: "keyword"},
    {regex: /true|false|null|undefined/, token: "atom"},
    {regex: /0x[a-f\d]+|[-+]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/i,
     token: "number"},
    {regex: /--.*/, token: "comment"},
    {regex: /\[.*\]/, token: "comment"},
    //{regex: /\/(?:[^\\]|\\.)*?\//, token: "variable-3"},
    // A next property will cause the mode to move to a different state
    {regex: /\/\*/, token: "comment", next: "comment"},
    {regex: /[-+\/*=<>!]+/, token: "operator"},
    // indent and dedent properties guide autoindentation
    //{regex: /[\{\[\(]/, indent: true},
    //{regex: /[\}\]\)]/, dedent: true},
    {regex: /[a-z$][\w$]*/, token: "variable"},
  ],
  // The multi-line comment state.
  comment: [
    {regex: /.*?\*\//, token: "comment", next: "start"},
    {regex: /.*/, token: "comment"}
  ],
  // The meta property contains global information about the mode. It
  // can contain properties like lineComment, which are supported by
  // all modes, and also directives like dontIndentStates, which are
  // specific to simple modes.
  meta: {
    dontIndentStates: ["comment"],
    lineComment: "--"
  }
});

function parse_errors( input ) {
    var ret  = [];
    
    var lines = input.split("\n");
    
    if( lines.length < 5 || ddl == null )
        return ret;
    
    ret = ret.concat(line_mismatch(lines));
    ddl.translate(input);
    ret = ret.concat(ref_error(lines));

    return ret;
}

function line_mismatch( lines ) {
    var ret  = [];
    
    var indent = guessIndent( lines )
    
    for( var i = 1; i < lines.length; i++ ) {
        var priorline = lines[i-1];
        var line = lines[i];
        
        var priorIndent = apparentDepth(priorline);
        var lineIndent = apparentDepth(line);
        
        if( lineIndent == 0 )
            continue;
       
        if( priorIndent < lineIndent && lineIndent < priorIndent+indent )
            ret.push({
                        from: {line:i, ch:lineIndent,  },
                        to: {line:i, ch:lineIndent+1,  },
                        //severity: "error",
                        message: "Misaligned code. \nThe indent appears to be "+indent+" spaces."
            });
    }

    return ret;
}

function guessIndent( lines ) {    	
    var idents = [];
    
    var priorFullIndent = -1;
    var priorRelativeIndents = [];
    
    for( var i = 0; i < lines.length; i++ ) {
        var line = lines[i];
        if( "\n" == line )
            continue;
        
        var ident = apparentDepth(line);
        
        if( priorFullIndent == -1 ) {
            priorFullIndent = ident;
            priorRelativeIndents.push(ident);
            continue;
        }
        var index = ident - priorFullIndent;
        if( index == 0 ) {
            var tmp = priorRelativeIndents[priorRelativeIndents.length-1];
            if( tmp != 0 )
                index = tmp;
        }
        if( index < 0 ) {
            index = -index;
            priorRelativeIndents.length--;
        } else {
            if( priorFullIndent < ident)
                priorRelativeIndents.push(index);
        }
        if( index != 0 ) {
            if( idents[index] == null )
                idents[index] = 0;
            idents[index]++;
        }           
        priorFullIndent = ident;
    }
    var ret = 1;
    var cmp = idents[ret];
    if( cmp == null )
        cmp = 0;
    for( var i = 1; i < idents.length; i++ ) {
        if( cmp < idents[i] ) {
            ret = i;
            cmp = idents[i];
        }
    }
    return ret;
}

function apparentDepth( line ) {
    var chunks = line.split(/ |\t/);
    var offset = 0;
    for( var j = 0; j < chunks.length; j++ ) {
        var chunk = chunks[j]/*.intern()*/;
        //if( "\t" == chunk )
            //TODO;
        if( "" == chunk  ) {
            offset++;
            continue;
        }
        if( !/[^.a-zA-Z0-9_"]/.test(chunk) ) 
            return offset;
    }
    return 0;
}

function ref_error( lines ) {
    var ret  = [];
    
    for( var i = 0; i < ddl.forest.length; i++ ) {
    	var node = ddl.forest[i];
        var nodeUpperContent = node.trimmedContent().toUpperCase();
        if( node.parseType() == 'VIEW' ) {
            var chunks = nodeUpperContent.split(' ');
            for( var j = 2; j < chunks.length; j++ ) { 
                if( chunks[j].trim() == "" )
                    continue;
                if( 0 == chunks[j].indexOf("/") )
                    continue;
                var tbl = ddl.find(chunks[j]);
                if( tbl == null ) {
                    var pos = nodeUpperContent.indexOf(chunks[j]);
                    ret.push({
                        from: {line:node.x, ch:pos,  },
                        to: {line:node.x, ch:pos+chunks[j].length,  },
                        //severity: "error",
                        message: "Undefined object"
                    });
                }
           }
        }
    }
    
    for( var i = 0; i < lines.length; i++ ) {
        var line = lines[i];
        var lineUpperContent = line.toUpperCase();
        if( 0 < lineUpperContent.indexOf("/FK") ) {
            var chunks = lineUpperContent.split(' ');
            var refIsNext = false;
            for( var j = 1; j < chunks.length; j++ ) { 
                if( chunks[j].trim() == "" )
                    continue;
                if( chunks[j] == "/FK" ) {
                    refIsNext = true;
                    continue;
                }
                if( !refIsNext )
                    continue;
                var tbl = ddl.find(chunks[j]);
                if(  tbl == null ) {
                    var pos = lineUpperContent.indexOf(chunks[j]);
                    ret.push({
                        from: {line:i, ch:pos,  },
                        to: {line:i, ch:pos+chunks[j].length,  },
                        //severity: "error",
                        message: "Undefined object"
                    });                   
                    break;
                }
            }
        }
   }

    return ret;
}

