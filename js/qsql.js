var qsql = (function () {
    function QSQL() {
        this.introspect = function (key, value, level, arraySize) {
            var output = '\n'+indent(level);

            if( key != null )
                output += key;
            else {
                output = "";
                if( level == 0 ) {
                    for( property in value ) {
                        //const field = value[property];
                        var suffixes = ["_address", "_id", "_name"];
                        var found = false;
                        for( let i = 0; i < suffixes.length; i++ ) {
                            const suffix = suffixes[i];
                            if( property.endsWith(suffix) ) {
                                output += property.substring(0,property.length-suffix.length)+'s';
                                found = true;
                                break;
                            }
                        }
                        if( !found  )
                            output += "unnamed_entity";  
                        key = output.toLowerCase();      
                        break;
                    }
                }
            }
 
            const type = typeof value;
            if( type == "object" ) {
                if( Array.isArray(value) ) {
                    for( property in value ) {
                        if( 1 <= property )
                            alert('!');
                        const field = value[property];
                        return this.introspect(key, field, level, value.length)
                    }
                } else {
                    if (output != "") {
                       if( arraySize != null )
                           output += '  /array ';
                       output += '  /insert '+(arraySize==null?1:arraySize);
                    }
                }
                var promotedField = ""
                for( property in value ) {
                    const field = value[property];
                    if( property != null  ) {
                        const fld = singular(key);
                        const cmp = property.toLowerCase();
                        if( key != null && fld + "_id" == cmp && arraySize == null && 0 < level )
                            promotedField = property;
                        if( fld + "_id" == cmp )
                            continue;
                    }
                    const subtree = this.introspect(property, field, level + 1);
                    output += subtree;
                }
                if( promotedField != "" )
                    output += '\n'+indent(level)+ promotedField;
            } else {
                //output += '=' + value;
            }

            if( level == 0 ) {
                var rootTable = output.substring(0, output.indexOf(" "));
                if( rootTable != "\n" )
                    output += "\n\nview "+rootTable+"_model_view "+rootTable ;
            }

            return output;
        };
    }

    this.indent = function (depth) {
        var s = "";
        for (var i = 0; i < depth; i++)
            s = s + "   ";
        return s;
    }

    return new QSQL();
}());