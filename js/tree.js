var ddl= require('./ddl');
var singular= require('./singular').singular;
var translate= require('./translate').translate;
var sample= require('./sample').sample;
var lexer = require('./lexer').lexer;


var tree = (function(){ 
    var tab= '   ';
    function ddlnode( x, inputLine, parent ) {
        this.x = x;
        this.y = function() {
            if( this.children.length == 0 )
                return this.x+1;
            else
                return this.children[this.children.length-1].y();
        };
        this.parent = parent;
        this.children = [];
        if( parent != null )
            parent.children.push(this);
        
        this.fks = null;
        this.pk = null;
                
        this.descendants = function() {
            var ret = [];
            ret.push(this);
            for( var i = 0; i < this.children.length; i++ ) 
                ret = ret.concat(this.children[i].descendants());
            return ret;
        }
        
        this.maxChildNameLen = function() {
            var maxLen = 2;
            var tmp = this.trimmedContent().toUpperCase();
            if( ddl.optionEQvalue("Audit Columns",'yes') || 0 < tmp.indexOf('/AUDITCOLS') )
                maxLen = 'updated_by'.length;
            if( ddl.optionEQvalue("Row Version Number",'yes') || 0 < tmp.indexOf('/ROWVERSION') )
                maxLen = 'row_version'.length;
            if( this.fks != null )
                for( var col in this.fks ) {
                    //var parent = this.fks[col];
                    var len = col.length;
                    if( maxLen < len )
                        maxLen = len;
                }
            for( var i = 0; i < this.children.length; i++ ) {
                if( 0 < this.children[i].children.length )
                    continue;
                var len = this.children[i].parseName().length;
                if( maxLen < len )
                    maxLen = len;
            }
            var cols = ddl.additionalColumns();
            for( var col in cols ) {
                var len = col.length;
                if( maxLen < len )
                    maxLen = len;
            }
 
            return maxLen;
        }
        
        this.content = inputLine;
        this.comment;
        this.trimmedContent = function() {
            var ret = this.content.trim();
            var start = ret.indexOf('[');
            var end = ret.indexOf(']');
            if( this.comment == null && 0 < start ) 
                this.comment = ret.substr(start+1, end-start-1);
            if( 0 < start ) {
                ret = ret.substr(0,start) + ret.substr(end+2);
            }
            var start = ret.indexOf('--');
            if( this.comment == null && 0 < start ) 
                this.comment = ret.substr(start+2);
            if( 0 < start ) {
                ret = ret.substr(0,start);
            }
            return ret.trim();
        }
         
        this.parseName = function( prefix ) {
            
            function replaceTrailing ( ret, postfix ) { 
                   if( 0 < ret.indexOf(postfix) && ret.indexOf(postfix) == ret.length-postfix.length )
                    return ret.substring(0, ret.length-postfix.length);
                return ret;
            }
            
            var ret = this.trimmedContent();
            var  qtBegin = ret.indexOf('"');
               var  qtEnd = ret.indexOf('"', qtBegin+1);
               if( 0 <= qtBegin && qtBegin < qtEnd )
                   return ret.substring(qtBegin, qtEnd+1);
                
            ret = ret.toUpperCase();
            
            if( 0 == ret.indexOf('VIEW ') ) {
                var chunks = ret.split(' ');
                return ddl.objPrefix() + chunks[1];
            }
            ret = replaceTrailing(ret,' D');
            var pos = ret.indexOf('/');
            if( 0 < pos )
                ret = ret.substring(0,pos);
            ret = ret.trim();
            ret = replaceTrailing(ret,' INTEGER');
            ret = replaceTrailing(ret,' NUMBER');
            ret = replaceTrailing(ret,' INT');
            ret = replaceTrailing(ret,' NUM');
            ret = replaceTrailing(ret,' CLOB');
            ret = replaceTrailing(ret,' BLOB');
            ret = replaceTrailing(ret,' DATE');
            ret = replaceTrailing(ret,' TSWTZ');
            ret = replaceTrailing(ret,' TSWLTZ');
            ret = replaceTrailing(ret,' TS');
            ret = ret.replace(/ VC\d+/g,'');
            ret = ret.trim();
            ret = ret.replace(/ /g,'_');
            if( prefix == undefined )
                if( 0 == this.children.length ) {   // switched to this comparison stile because accidental typo this.children.length = 0 is disastrous!
                    if( this.parent != undefined && this.parent.colprefix != undefined )
                        ret = this.parent.colprefix.toUpperCase()+'_' + ret;        		
                } else {
                    ret = ddl.objPrefix() + ret;
                }
            var c = ret.substr(0,1);
            if (c >= '0' && c <= '9') {
                ret = 'x'+ret;
            }        	
            return ret;
        }
        this.parseType = function( pure ) {
            var tmp = this.trimmedContent().toUpperCase();
            if( 0 == tmp.indexOf('--') ) 
                return "COMMENT";
            if( 0 == tmp.indexOf('VIEW ') ) 
                return "VIEW";
            var char = ddl.semantics();
             var len = 4000;	
            if( tmp.startsWith('NAME') || tmp.startsWith('EMAIL') )
                len = 255;
            if( 0 < tmp.indexOf(' VC') ) {
                var start = tmp.indexOf(' VC');
                var end = tmp.lastIndexOf(' ');
                if( end == start)
                    end = tmp.length;
                len = parseInt(tmp.substr(start+' VC'.length, end-start-' VC'.length).trim());
            }
            var ret = "VARCHAR2("+len+char+")";
            if( pure == 'PLSQL' )
                ret = "VARCHAR2";
            if( 0 < tmp.indexOf(' INT') ) 
                ret = "INTEGER";
            if( 0 < tmp.indexOf('_ID') ) 
                ret = "INTEGER";
            if( 0 < tmp.indexOf(' NUM') /*||  0 < tmp.indexOf('/PK')*/ ) 
                ret = "NUMBER";
            if( 0 == tmp.indexOf('DATE ') || 0 < tmp.indexOf(' DATE' ) || 0 < tmp.indexOf('_DATE') || 0 <= tmp.indexOf('HIREDATE')  
             || 0 < tmp.indexOf(' D') && tmp.indexOf(' D') == tmp.length-' D'.length 
            )        		
                ret = ddl.getOptionValue("Date Data Type").toUpperCase();            	
            if( 0 < tmp.indexOf(' CLOB') ) 
                ret = "CLOB";
            if( 0 < tmp.indexOf(' BLOB') ) 
                ret = "BLOB";
            if( 0 < tmp.indexOf(' TS') ) 
                ret = "TIMESTAMP";
            if( 0 < tmp.indexOf(' TSWTZ') ) 
                ret = "TIMESTAMP WITH TIME ZONE";
            if( 0 < tmp.indexOf(' TSWLTZ') ) 
                ret = "TIMESTAMP WITH LOCAL TIME ZONE";

            if( pure )
                return ret;	

            if( 0 < tmp.indexOf('/UNIQUE') ) {
                ret += '\n';  
                ret += tab +  tab+' '.repeat(parent.maxChildNameLen()) +'constraint '+parent.parseName('noprefix=>true')+'_'+this.parseName('noprefix=>true')+'_unq unique';
            } 
            if( 0 <= tmp.indexOf('/NN') || 0 <= tmp.indexOf('/NOT NULL') ) 
                ret += ' not null';
            if( 0 <= tmp.indexOf('/HIDDEN') || 0 <= tmp.indexOf('/INVISIBLE') ) 
                ret += ' invisible';
                var optQuote = "'";
                if(  ret.startsWith('INTEGER') || ret.startsWith('NUMBER') || ret.startsWith('DATE')  ) 
                    optQuote = "";
             if( 0 <= tmp.indexOf('/DEFAULT') ) {
                var start = tmp.indexOf('/DEFAULT');
                var end = tmp.lastIndexOf('/');
                if( end == start)
                    end = tmp.length;
                var value = tmp.substr(start+'/DEFAULT'.length, end-start-'/DEFAULT'.length).trim();
                ret +=' default '+'on null ' + optQuote+value+optQuote ;
            }
            if( 0 <= tmp.indexOf('/CHECK') ) {
                var start = tmp.indexOf('/CHECK');
                var end = tmp.lastIndexOf('/');
                if( end == start)
                    end = tmp.length;
                var values = tmp.substr(start+'/CHECK'.length, end-start-'/CHECK'.length).trim();
                if( 0 < values.indexOf(', ') )
                    values = values.replace(/, /g,optQuote+","+optQuote).toUpperCase();
                else if( 0 < values.indexOf(',') )
                    values = values.replace(/,/g,optQuote+","+optQuote).toUpperCase();
                else	
                    values = values.replace(/ /g,optQuote+","+optQuote).toUpperCase();
                 ret +=' constraint '+parent.parseName()+'_'+this.parseName('noprefix=>true')+'_CK\n';
                ret +="           check ("+this.parseName('noprefix=>true')+" in ("+optQuote+values+optQuote+"))";        		
            }
            if( 0 <= tmp.indexOf('/BETWEEN') ) {
                var start = tmp.indexOf('/BETWEEN');
                var end = tmp.lastIndexOf('/');
                if( end == start)
                    end = tmp.length;
                var values = tmp.substr(start+'/BETWEEN'.length, end-start-'/BETWEEN'.length).trim();
                ret +=' constraint '+parent.parseName('noprefix=>true')+'_'+this.parseName('noprefix=>true')+'_BET\n';
                ret +="           check ("+this.parseName('noprefix=>true')+" between "+values+")";        		
            }
            if( 0 < tmp.indexOf('/PK') ) {
                if( this.parent != null )
                     this.parent.pk = this;
                let typeModifier = ' NOT NULL';
                if( ret.startsWith('NUMBER') )
                    typeModifier = ' GENERATED BY DEFAULT ON NULL AS IDENTITY';
                ret += typeModifier +'\n';  
                ret += tab +  tab+' '.repeat(parent.maxChildNameLen()) +'constraint '+parent.parseName()+'_'+this.parseName('noprefix=>true')+'_pk primary key';
             } 
            return ret;
        }
        
        this.isExplicitPk = function() {
            for( var i = 0; i < this.children.length; i++ ) {
                var child = this.children[i];
                var tmp = child.trimmedContent().toUpperCase();
                if( 0 < tmp.indexOf('/PK') )
                    return true;
            }
            return false;
        }
        
        this.refId = function() {
            var tmp = this.trimmedContent().toUpperCase();
            var pos = tmp.indexOf(' ID ');
            if( 0 < pos )
                return tmp.substr(0,pos)+'S';
            pos = tmp.indexOf(' ID');
            if( 0 < pos && pos == tmp.length-' ID'.length )
                return tmp.substr(0,pos)+'S';
            pos = tmp.indexOf('/FK');
            if( 0 < pos )
                return tmp.substr(pos+'/FK'.length).trim().replace(' ','_');
            pos = tmp.indexOf('/REFERENCE');
            if( 0 < pos )
                return tmp.substr(pos+'/REFERENCE '.length).trim().replace(' ','_');
            return null;
        }

        this.parseValues = function() {
            var tmp = this.trimmedContent().toUpperCase(); 
            if( 0 <= tmp.indexOf('/CHECK') || 0 <= tmp.indexOf('/VALUES') ) {
                var substr = '/CHECK';
                var start = tmp.indexOf(substr);
                if( start < 0 ) {
                    substr = '/VALUES';
                    start = tmp.indexOf(substr);  
                }
                var end = tmp.lastIndexOf('/');
                if( end == start)
                    end = tmp.length;
                var values = tmp.substr(start+substr.length, end-start-substr.length).trim();
                if( 0 < values.indexOf(',') ) {
                    values = values.replace(/ /g,"");
                    return values.split(',');
                } else
                    return values.split(' ');        	            	
            }
            if( 0 <= tmp.indexOf('/BETWEEN') ) {
                var start = tmp.indexOf('/BETWEEN');
                var end = tmp.lastIndexOf('/');
                if( end == start)
                    end = tmp.length;
                var values = tmp.substr(start+'/BETWEEN'.length, end-start-'/BETWEEN'.length).trim();
                values = values.replace(" AND "," ");
                var ret = [];
                for( var i = parseInt(values.split(' ')[0]); i <= parseInt(values.split(' ')[1]) ; i++ )
                    ret.push(i);
                return ret;        		
            }
            return null;
        }
        
        
        this.apparentDepth = function() {
            var chunks = this.content.split(/ |\t/);
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
            throw 'No alphanumerics in the node content';    
        }
        this.depth = function() {
            if( this.parent == null )
                return 0;
            return this.parent.depth()+1;
        }

        this.location = function() {
            return "["+x+","+this.y()+")";
        }
        this.offset = function( padding ) {
            var s = "";
            for( var i = 0; i < this.depth() ; i++ )
                s = s + padding;
            return s;
        }
        this.toString = function( padding ) {
            return this.offset(padding)
                    //+ nbrsp;
                + this.location()
                + padding
                + this.content
                ;
        }
        this.isLeaf = function(  ) {
            return this.children.every((c) => c.children.length == 0);
        }
        this.toDDL = function(  ) {
                        
            if( this.parseType() == "VIEW" ) 
                return ""; // postponed

            if( this.parseType() == "COMMENT" ) 
                return this.content;
            
            if( this.children.length == 0 ) {
                let pad = tab;
                if( this.parent != undefined )
                    pad += ' '.repeat(this.parent.maxChildNameLen() - this.parseName().length);
                return this.parseName()+pad+this.parseType();
            } 
            
            if( this.fks == null ) {
                this.fks = [];
                if( this.parent != null  )
                    this.fks[singular(this.parent.parseName('noprefix=>true'))+'_ID']=this.parent.parseName('noprefix=>true');
                for( var i = 0; i < this.children.length; i++ ) 
                    if( this.children[i].refId() != null ) {
                        this.fks[this.children[i].parseName()]=this.children[i].refId();
                    }
            }
            
            var postponed = [];
            var indexedColumns = [];
            var ret = "";
            ret =  ret + 'create table '+this.parseName()+" (\n";
            var pad = tab+' '.repeat(this.maxChildNameLen() - 'ID'.length);
            if( !this.isExplicitPk() && ddl.optionEQvalue("Auto Primary Key",'yes') ) {
                let typeModifier = 'GENERATED BY DEFAULT ON NULL AS IDENTITY';
                if( ddl.getOptionValue("Primary Key Maintenance") != ddl.identityDataType )
                    typeModifier = 'not null';
                ret += tab +  'ID' + pad + 'NUMBER ' + typeModifier + '\n';  
                ret += tab +  tab+' '.repeat(this.maxChildNameLen()) +'constraint '+this.parseName()+'_ID_PK primary key,\n';
            }
            for( var fk in this.fks ) {	
                let parent = this.fks[fk];				
                let type = 'NUMBER';
                let refNode = ddl.find(parent);
                if( refNode != null && refNode.pk != null )
                    type = refNode.pk.parseType(pure=>true);
                pad = tab+' '.repeat(this.maxChildNameLen() - fk.length);
                ret += tab + fk + pad + type + '\n';  
                ret += tab + tab+' '.repeat(this.maxChildNameLen()) + 'constraint '+this.parseName(/*'noprefix=>true'*/)+'_'+fk+'_FK\n';
                let onDelete = ' on delete '+ddl.getOptionValue("On Delete").toLowerCase();
                if( ddl.optionEQvalue("On Delete",'Restrict') )
                    onDelete = '';
                let	notNull = '';
                for( c in this.children ) {
                    var child = this.children[c];
                    if( fk == child.parseName() )  {
                        var tmp = child.trimmedContent().toUpperCase();
                        if( 0 <= tmp.indexOf('/NN') || 0 <= tmp.indexOf('/NOTNULL')  ) 
                            notNull = ' NOT NULL'
                        break;
                    }
                }
                ret += tab + tab+' '.repeat(this.maxChildNameLen()) + 'references '+ddl.objPrefix()+parent+onDelete+notNull+',\n';
            }
            for( var i = 0; i < this.children.length; i++ ) {
                var child = this.children[i];
                if( 0 < child.children.length ) {
                    postponed.push(child);
                    continue;
                }
                if (child.refId() == null  ) {
                    if( this.conflictsWithID(child) )
                        continue; //ret += '--';
                    ret += tab + child.toDDL([]) +',\n';
                } 
            }
            var tmp = this.trimmedContent().toUpperCase();
            if( ddl.optionEQvalue("rowVersion",'yes') || 0 < tmp.indexOf('/ROWVERSION') ) {
                var pad = tab+' '.repeat(this.maxChildNameLen() - 'CREATED'.length);
                pad = tab+' '.repeat(this.maxChildNameLen() - 'ROW_VERSION'.length);
                ret += tab +  'ROW_VERSION' + pad + 'INTEGER not null,\n';              	
            }            	
            if( ddl.optionEQvalue("Audit Columns",'yes') || 0 < tmp.indexOf('/AUDITCOLS') ) {
                var pad = tab+' '.repeat(this.maxChildNameLen() - 'CREATED'.length);
                ret += tab +  'CREATED' + pad + ddl.getOptionValue("Date Data Type").toUpperCase() + ' not null,\n';  
                pad = tab+' '.repeat(this.maxChildNameLen() - 'CREATED_BY'.length);
                ret += tab +  'CREATED_BY' + pad + 'VARCHAR2(255'+ddl.semantics()+') not null,\n';  
                pad = tab+' '.repeat(this.maxChildNameLen() - 'UPDATED'.length);
                ret += tab +  'UPDATED' + pad + ddl.getOptionValue("Date Data Type").toUpperCase() + ' not null,\n';  
                pad = tab+' '.repeat(this.maxChildNameLen() - 'UPDATED_BY'.length);
                ret += tab +  'UPDATED_BY' + pad + 'VARCHAR2(255'+ddl.semantics()+') not null,\n';  
            }            	
            var cols = ddl.additionalColumns();
            for( var col in cols ) {
                var type = cols[col];
                pad = tab+' '.repeat(this.maxChildNameLen() - col.length);
                ret += tab +  col.toUpperCase() + pad + type + ' not null,\n';  
            }
            if( ret.lastIndexOf(',\n') == ret.length-2 )
                ret = ret.substr(0,ret.length-2)+'\n';
            ret += ')'+(ddl.optionEQvalue("Compression",'yes') || 0 < tmp.indexOf('/COMPRESS')?' compress':'')+';\n\n';
            
            let num = 1;
            for( var fk in this.fks ) {
                var parent = this.fks[fk];
                var ref = parent;
                if( parent.endsWith('S') )
                    ref = ref.substr(0,ref.length-1);
                var col = fk;
                if( col == null )
                    col = singular(ref)+'_ID';	
                   ret += 'create index '+this.parseName()+'_i'+(num++)+' on '+this.parseName()+' ('+col+');\n\n';
            }
            
            //ret += this.generateTrigger();
            
            var j = 1;
            for( var i = 0; i < this.children.length; i++ ) {
                var child = this.children[i];
                var tmp = child.trimmedContent().toUpperCase();
                if( 0 <= tmp.indexOf('/IDX') || 0 <= tmp.indexOf('/INDEX')  ) 
                       ret += 'create index '+this.parseName()+'_i'+(num++)+' on '+this.parseName()+' ('+child.parseName()+');\n';                
            }
            
            if( this.comment != null )
                ret += "comment on table "+this.parseName()+" is '"+this.comment+"';\n";
            for( var i = 0; i < this.children.length; i++ ) {
                var child = this.children[i];
                if( child.comment != null && child.children.length == 0 )
                    ret += "comment on column "+this.parseName()+'.'+child.parseName()+" is '"+child.comment+"';\n";
            }
            ret += '\n';
            
            for( var i = 0; i < postponed.length; i++ ) {
                ret += postponed[i].toDDL();
            }
            
            return ret;
        }

        this.generateDrop= function() {
            let ret = "";
            if( this.parseType() == "VIEW" ) 
                ret = 'drop view '+this.parseName()+";\n";
            if( 0 < this.children.length ) {
                ret = 'drop table '+this.parseName()+" cascade constraints;\n";
                if( ddl.optionEQvalue("api",'yes') )
                     ret+= 'drop package '+this.parseName()+"_api;\n";
            }
            return ret;
        }	

        this.generateView = function() {
            if( this.parseType() != "VIEW" ) 
                return "";

            if( ddl.optionEQvalue("Duality View",'yes') ) {
                return this.generateDualityView()
            }
            var tmp = this.trimmedContent().toUpperCase();
            var chunks = tmp.split(' ');
            var ret = 'create or replace view  ' +this.parseName()+ " as\n";
            ret += 'select\n';
            var maxLen = 0;
            for( var i = 2; i < chunks.length; i++ ) { 
                var tbl = ddl.find(chunks[i]);
                if( tbl == null )
                    return "";
                var len = (chunks[i]+'.ID').length;
                if( maxLen < len )
                    maxLen = len;
                for( var j = 0; j < tbl.children.length; j++ ) {
                    var child = tbl.children[j];
                    len = (chunks[i]+'.'+child.parseName()).length;
                    if( maxLen < len )
                        maxLen = len;
                }
            }
            var colCnts = {};
            for( var i = 2; i < chunks.length; i++ ) { 
                var tbl = ddl.find(chunks[i]);
                if( tbl == null )
                    continue;
                for( var j = 0; j < tbl.children.length; j++ ) {
                    var child = tbl.children[j];
                    var col = child.parseName();
                    var cnt = colCnts[col];
                    if( cnt == null )
                        cnt = 0;
                    colCnts[col] = cnt+1;	
                }
            }
            for( var i = 2; i < chunks.length; i++ ) { 
                var tbl = ddl.find(chunks[i]);
                if( tbl == null )
                    continue;
                var pad = ' '.repeat(maxLen - (chunks[i]+'.ID').length);
                ret += tab + chunks[i]+'.ID'+tab+pad+singular(chunks[i])+'_ID,\n';
                for( var j = 0; j < tbl.children.length; j++ ) {
                    var child = tbl.children[j];
                    if( 0 == child.children.length ) {
                        pad = ' '.repeat(maxLen - (chunks[i]+'.'+child.parseName()).length);
                        var disambiguator = '';
                        if( 1< colCnts[child.parseName()] )
                            disambiguator = singular(chunks[i])+'_';
                        ret += tab + chunks[i]+'.'+child.parseName()+tab+pad+disambiguator+child.parseName()+',\n';
                    }
                }
                var tmp = tbl.trimmedContent().toUpperCase();
                if( ddl.optionEQvalue("rowVersion",'yes') || 0 < tmp.indexOf('/ROWVERSION') ) {
                    var pad = tab+' '.repeat(tbl.maxChildNameLen() - 'ROW_VERSION'.length);
                    ret += tab + chunks[i]+'.'+ 'ROW_VERSION' + pad + chunks[i]+'_'+ 'ROW_VERSION,\n';              	
                }            	
                if( ddl.optionEQvalue("Audit Columns",'yes') || 0 < tmp.indexOf('/AUDITCOLS') ) {
                    var pad = tab+' '.repeat(tbl.maxChildNameLen() - 'CREATED'.length);
                    ret += tab + chunks[i]+'.'+  'CREATED' + pad + chunks[i]+'_'+ 'CREATED,\n';  
                    pad = tab+' '.repeat(tbl.maxChildNameLen() - 'CREATED_BY'.length);
                    ret += tab + chunks[i]+'.'+  'CREATED_BY' + pad + chunks[i]+'_'+  'CREATED_BY,\n';  
                    pad = tab+' '.repeat(tbl.maxChildNameLen() - 'UPDATED'.length);
                    ret += tab + chunks[i]+'.'+  'UPDATED' + pad + chunks[i]+'_'+  'UPDATED,\n';  
                    pad = tab+' '.repeat(tbl.maxChildNameLen() - 'UPDATED_BY'.length);
                    ret += tab + chunks[i]+'.'+  'UPDATED_BY' + pad + chunks[i]+'_'+  'UPDATED_BY,\n';  
                }            	
            }
            if( ret.lastIndexOf(',\n') == ret.length-2 )
                ret = ret.substr(0,ret.length-2)+'\n';
            ret += 'from\n'; 
            for( var i = 2; i < chunks.length; i++ ) {
                pad = ' '.repeat(maxLen - chunks[i].length);
                var tbl = chunks[i];
                if( ddl.objPrefix() != null && ddl.objPrefix() != '' )
                    ddl.objPrefix()+chunks[i] + pad + chunks[i];
                ret += tab + tbl + ',\n';
            }
            if( ret.lastIndexOf(',\n') == ret.length-2 )
                ret = ret.substr(0,ret.length-2)+'\n';
            ret += 'where\n'; 
            for( var i = 2; i < chunks.length; i++ )  
                for( var j = 2; j < chunks.length; j++ ) {
                    if( j == i )
                        continue;
                    var nameA = chunks[i];
                    var nameB = chunks[j];
                    var nodeA = ddl.find(nameA);
                    if( nodeA == null )
                        continue;
                    var nodeB = ddl.find(nameB);
                    if( nodeB == null )
                        continue;
                    for( var k in nodeA.fks ) {
                        var parent = nodeA.fks[k];
                        if( parent == nameB) {
                            ret += tab + nameA+'.'+singular(parent)+'_ID(+) = ' +nameB+'.ID and\n';
                        }
                    }
                } 
            if( ret.lastIndexOf(' and\n') == ret.length-' and\n'.length )
                ret = ret.substr(0,ret.length-' and\n'.length)+'\n';
            ret += '/\n'; 
            return ret;
        }

        this.generateTrigger = function() {
            if( this.children.length == 0 ) 
                return "";
            var ret = 'create or replace trigger '+ this.parseName() +'_BIU\n';
            ret += '    before insert or update\n'; 
            ret += '    on '+ this.parseName() +'\n';
            ret += '    for each row\n';
            ret += 'begin\n';
            var OK = false;
            var user = 'user';
            if( ddl.optionEQvalue("apex",'yes') ) {
                user = "coalesce(sys_context('APEX$SESSION','APP_USER'),user)";
            }
            for( var i = 0; i < this.children.length; i++ ) {
                var child = this.children[i]; 
                method = null;
                if( 0 < child.content.indexOf('/lower') ) 
                    method = 'LOWER';
                else if( 0 < child.content.indexOf('/upper') ) 
                    method = 'UPPER';
                if( method == null )
                    continue;
                ret += '    :new.'+child.parseName()+' := '+method+'(:new.'+child.parseName()+');\n';
                OK = true;
            }
            var tmp = this.trimmedContent().toUpperCase();
            if( ddl.optionEQvalue("Row Version Number",'yes') || 0 < tmp.indexOf('/ROWVERSION') )  {
                ret += '    if inserting then\n';
                ret += '        :new.row_version := 1;\n';
                ret += '    elsif updating then\n';
                ret += '        :new.row_version := NVL(:old.row_version, 0) + 1;\n';
                ret += '    end if;\n';
                OK = true;
            }
           if( ddl.optionEQvalue("Audit Columns",'yes') || 0 < tmp.indexOf('/AUDITCOLS') ) {
                ret += '    if inserting then\n';
                ret += '        :new.created := SYSDATE;\n';
                ret += '        :new.created_by := '+user+';\n';
                ret += '    end if;\n';
                ret += '    :new.updated := SYSDATE;\n';
                ret += '    :new.updated_by := '+user+';\n';
                OK = true;
            }
            if( ddl.optionEQvalue("Auto Primary Key",'yes') && ddl.getOptionValue("Primary Key Maintenance") != ddl.identityDataType  )  {
                ret += '    if :new.id is null then\n';
                ret += "        :new.id := to_number(sys_guid(), 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');\n";
                ret += '    end if;\n';
                OK = true;
            }
            var cols = ddl.additionalColumns();
            for( var col in cols ) {
                var type = cols[col];
                ret += '    if :new.'+col+' is null then\n';
                if( type.startsWith('INT') )
                    ret += '        '+col+' := 0;\n';
                else
                    ret += '        '+col+" := 'N/A';\n";
                ret += '    end if;\n';
                OK = true;
            }
              if( !OK )
                return '';
            ret += 'end ' + this.parseName() + '_BIU;\n/\n\n';
            return ret;
        }


        this.procDecl = function( kind /* get, insert, update */ ) {
            let modifier = '';
            if( kind != 'get' )
                modifier = ' default null';
            let mode = 'out';
            if( kind != 'get' )
                mode = ' in';
            let ret =  tab+'procedure '+kind+'_row (\n'; 
            ret += tab+tab+'p_id        in  number'+modifier;
            for( var fk in this.fks ) {	
                let parent = this.fks[fk];				
                let type = 'NUMBER';
                let refNode = ddl.find(parent);
                if( refNode != null && refNode.pk != null )
                    type = refNode.pk.parseType(pure=>true);
                //pad = tab+tab+' '.repeat(this.maxChildNameLen() - fk.length);
                ret += ',\n';
                ret += tab+tab+'P_'+fk+'   '+mode+'  '+type+modifier;
            }
            for( var i = 0; i < this.children.length; i++ ) {
                var child = this.children[i]; 
                if( child.children.length != 0 ) 
                    continue;
                ret += ',\n';
                ret += tab+tab+'P_'+child.parseName()+'   '+mode+'  '+child.parseType('PLSQL')+modifier;
            }
            ret += '\n    )';
            return ret;
        }
        this.procBody = function( kind /* get, insert, update */ ) {
            let ret =    tab+'is \n';
            ret +=    tab+'begin \n';
            let prelude =    tab+tab+'for c1 in (select * from '+this.parseName()+' where id = p_id) loop \n';
            if( kind == 'insert' ) {
                prelude =    tab+tab+'insert into '+this.parseName()+' ( \n';
                prelude += tab+tab+'id';
            }
            if( kind == 'update' ) {
                prelude =    tab+tab+'update  '+this.parseName()+' set \n';
                prelude += tab+tab+'id = p_id';
            }
            ret += prelude;
            for( var fk in this.fks ) {	
                let parent = this.fks[fk];				
                let type = 'NUMBER';
                let refNode = ddl.find(parent);
                if( refNode != null && refNode.pk != null )
                    type = refNode.pk.parseType(pure=>true);
                //pad = tab+tab+' '.repeat(this.maxChildNameLen() - fk.length);
                if( kind == 'insert' || kind == 'update' ) 
                    ret += ',\n';
                let row = '        P_'+fk+' := c1.'+fk+';\n';	
                if( kind == 'insert' ) 
                    row = '        '+fk;
                if( kind == 'update' ) 
                    row = '        '+fk+' = P_'+fk+'\n';	
                ret += row;
            }
            for( var i = 0; i < this.children.length; i++ ) {
                var child = this.children[i]; 
                if( child.children.length != 0 ) 
                    continue;
                if( kind == 'insert' || kind == 'update' ) 
                    ret += ',\n';
                let row = '        P_'+child.parseName()+' := c1.'+child.parseName()+';\n';	
                if( kind == 'insert' ) 
                    row = '        '+child.parseName();
                if( kind == 'update' ) 
                    row = '        '+child.parseName()+' = P_'+child.parseName()+'\n';	
                ret += row;
            }
            if( kind == 'insert' ) {
                ret +=    '        ) values ( \n';
                ret +=    '            p_id';
                for( var fk in this.fks ) {	
                    ret += ',\n';
                    ret += '        P_'+fk;
                }
                for( var i = 0; i < this.children.length; i++ ) {
                    var child = this.children[i]; 
                    if( child.children.length != 0 ) 
                        continue;
                    ret += ',\n';
                    ret += '        P_'+child.parseName();
                }
            }
            let finale = '\n        end loop;\n';
            if( kind == 'insert' )
                finale = '        );'
            if( kind == 'update' )
                finale = '    where id = p_id;'
            ret += finale;
            ret += '    end '+kind+'_row;\n ';
            ret += '\n ';
            return ret;
        }
        this.generateTAPI = function() {
            if( this.children.length == 0 ) 
                return "";
            var ret = 'create or replace package '+ this.parseName() +'_API\nis\n\n';
            ret += this.procDecl('get'); 
            ret += ';\n\n';
            ret += this.procDecl('insert'); 
            ret += ';\n\n';
            ret += this.procDecl('update'); 
            ret += ';\n\n';
            ret += '    procedure delete_row (\n'+
                '        p_id              in number\n'+
                '    );\n'+
                'end '+this.parseName()+'_api;\n'+
                '/\n\n';
            ret += 'create or replace package body '+ this.parseName() +'_API\nis\n\n';
            ret += this.procDecl('get'); 
            ret += '\n';
            ret += this.procBody('get');

            ret += this.procDecl('insert'); 
            ret += '\n';
            ret += this.procBody('insert'); 

            ret += this.procDecl('update'); 
            ret += '\n';
            ret += this.procBody('update'); 

            ret += '    procedure delete_row (\n'
            ret += '        p_id              in number\n'
            ret += '    )\n'
            ret += '    is\n'
            ret += '    begin\n'
            ret += '        delete from '+this.parseName()+' where id = p_id;\n'
            ret += '    end delete_row;\n'
            ret += 'end '+this.parseName()+'_api;\n'
            ret += '/\n';
            return ret;
        }

        this.rows = 0;       
        this.generateData = function() {
            var ret = '';
            
            var tmp = this.trimmedContent();
            var start = tmp.indexOf('/insert ');
            if( 0 < start ) {
                tmp = tmp.substr(start+'/insert '.length);
                var tmps = tmp.split(' ');
                this.rows = parseInt(tmps[0]);
                if( 300 < this.rows )
                    this.rows = 300;
                for( var i = 0; i < this.rows; i++ ) {
                    ret += 'insert into '+this.parseName()+' (\n';
                    if( /*!this.isExplicitPk() &&*/ ddl.optionEQvalue("Auto Primary Key",'yes') ) {
                        ret += tab +  'ID,\n';  
                    }		
                    for( var fk in this.fks ) {
                        var parent = this.fks[fk];
                         ret += '    '+singular(parent)+'_ID,\n';
                    }
                    for( var j = 0; j < this.children.length; j++ ) {
                        var child = this.children[j]; 
                        if( 0 == child.children.length ) 
                            ret += '    '+child.parseName()+',\n';
                    }
                    if( ret.lastIndexOf(',\n') == ret.length-2 )
                        ret = ret.substr(0,ret.length-2)+'\n';
                    ret += ') values (\n';
                    if( /*!this.isExplicitPk() &&*/ ddl.optionEQvalue("Auto Primary Key",'yes') ) {
                        ret += tab + (i+1)+ ',\n';  
                    }		
                    for( var fk in this.fks ) {
                        var parent = this.fks[fk];
                        var ref = parent;
                        if( parent.endsWith('S') )
                            ref = ref.substr(0,ref.length-1);
                        var refNode = ddl.find(parent);
                          var values = [];
                        for( var k = 1; k <= refNode.rows ; k++ )
                            values.push(k);        
                        ret += '    '+translate(ddl.getOptionValue("Data Language"),sample(this.parseName(),singular(ref)+'_ID', 'INTEGER', values))+',\n';
                    }
                    for( var j = 0; j < this.children.length; j++ ) {
                        var child = this.children[j]; 
                        if( 0 == child.children.length ) 
                            ret += '    '+translate(ddl.getOptionValue("Data Language"),sample(this.parseName(),child.parseName(), child.parseType(), child.parseValues()))+',\n';
                    }
                    if( ret.lastIndexOf(',\n') == ret.length-2 )
                        ret = ret.substr(0,ret.length-2)+'\n';
                    ret += ');\n';
                }
                ret += '\n';
            }
            if( ret == '' )
                return ret;

            ret += 'commit;\n\n';

            if( /*!this.isExplicitPk() &&*/ ddl.optionEQvalue("Auto Primary Key",'yes') ) {
                ret += 'alter table '+this.parseName()+'\n'
              + 'modify id generated '+'always '/*'by default on null'*/+' as identity restart start with '+(i+1)+";";
            }
            
            for( var i = 0; i < this.children.length; i++ ) {
                var child = this.children[i]; 
                if( 0 < child.children.length ) 
                    ret += child.generateData();
            }

            return ret;
        }  
        
        this.isArray = function(  ) {
            if (this.content.includes('/array'))
                return true;
            var insert = this.content.indexOf('/insert ');
            if (0 < insert) {
                var tokens = this.content.substr(insert).split(/\s+/);
                return parseInt(tokens[1]) > 1;
            }
            return false;
        }
        this.hasNonArrayChildId = function( cname ) {
            if(!cname.endsWith('_ID'))
                return false;
            var name = cname.slice(0, -3); 
            return this.children.some((c) => c.children.length > 0 &&
             c.parseName('noprefix=>true') == name && !c.isArray());
        }
        this.generateSelectJsonBottomUp = function( tbl, indent) {
            var name = tbl.parseName('noprefix=>true');
            var ret = indent + "'" + getRefId(name) + "' : " + name +'.ID,\n';
            for( var j = 0; j < tbl.children.length; j++ ) {
                var child = tbl.children[j];
                var cname = child.parseName('noprefix=>true');
                if( 0 == child.children.length ) {
                    ret += indent + "'" + cname + "' : " + name + '.' + cname + ',\n';
                }
            }
            var ptbl = tbl.parent;
            if( ptbl != null ) { 
                var pname = ptbl.parseName('noprefix=>true');
                ret += indent + "'" + pname + "' : (\n";
                indent += '  ';
                ret += indent + 'select JSON {\n';
                ret += this.generateSelectJsonBottomUp( ptbl, indent + '  ');
                ret += indent + '} from ' + ptbl.parseName() + ' ' + pname + ' with (UPDATE)\n';
                ret += indent + 'where ' + name + '.' + pname + '_ID = ' + pname + '.ID\n';
                indent = indent.slice(0, -2);
                ret += indent + ')\n';
            } else {
                ret = ret.slice(0, -2) + '\n';
            }
            return ret;	
        }
        this.generateSelectJsonTopDown = function( tbl, indent) {
            var name = tbl.parseName('noprefix=>true');
            var ret = indent + "'" + getRefId(name) + "' : " + name + '.ID,\n';
            for( var j = 0; j < tbl.children.length; j++ ) {
                var child = tbl.children[j];
                var cname = child.parseName('noprefix=>true');
                if( 0 == child.children.length ) {
                    if (tbl.hasNonArrayChildId(cname))
                        continue;
                    ret += indent + "'" + cname + "' : " + name + '.' + cname;
                } else {
                    ret += indent + "'" + cname + "' : (\n";
                    var isArray = child.isArray();
                    indent += '  ';
                    ret += indent + 'select ' + (isArray?'JSON_ARRAYAGG(':'') + 'JSON {\n';
                    ret += this.generateSelectJsonTopDown(child, indent + '  ');
                    ret += indent + '}' + (isArray?')':'') + ' from ' + child.parseName() + ' ' + cname + ' with (UPDATE)\n';
                    var names = isArray? [name, cname] : [cname, name];
                    ret += indent + 'where ' + names[1] + '.' + getRefId(names[0]) + ' = ' + names[0] + '.ID\n';
                    indent = indent.slice(0, -2);
                    ret += indent + ')';
                }
                ret += (j < tbl.children.length - 1)? ',\n' : '\n';
            }
            return (ret[ret.length-2] == ',')? ret.slice(0, -2) + '\n' : ret;
        }
        this.generateDualityView = function(  ) {
            var tmp = this.trimmedContent().toUpperCase();
            var chunks = tmp.split(' ');
            var ret = '';
            var tbl = ddl.find(chunks[2]);
            if( tbl != null) {
                ret += 'create or replace json relational duality view ' + chunks[1] + ' as\n';
                ret += 'select JSON {\n';
                ret += tbl.isLeaf()? this.generateSelectJsonBottomUp(tbl, '  ') : this.generateSelectJsonTopDown(tbl, '  ');
                ret += '} from ' + tbl.parseName() + ' ' + chunks[2] + ' with (INSERT, UPDATE, DELETE);\n\n';
            }
            return ret;
        }

        
        render = function( table, depth ) {
            var row = table.insertRow(-1);
            var cell = row.insertCell(0);
            var nbrsp = String.fromCharCode(160);
            var nbrspX3 = nbrsp+nbrsp+nbrsp;
            //cell.innerHTML = this.toString(apparentDepth, nbrspX3);  //<---- no sugarcoating
            cell.innerHTML = "<font face=\"Lucida Console\" size=-1>"
            +this.offset(nbrspX3)
            + "<font color=blue face=\"Lucida Console\" size=-1>"
            + this.location()
            + nbrsp
            + "</font><font color=DarkMagenta face=\"Lucida Console\" size=-1>"
            + this.content.trim()
            ;
            for( var i = 0; i < this.children.length; i++ ) {
                var child = this.children[i];
                child.render(table, depth+1);
            }
        }

        this.conflictsWithID = function (child) {
            if( ddl.getOptionValue("Auto Primary Key") != 'yes' )
                return false;
            const upperName = child.parseName('noprefix=>true').toUpperCase();
            if( 'ID' == upperName )	
                return true;
            var table = singular(this.parseName('noprefix=>true').toUpperCase());
            if( table+'_ID' == upperName )	
                return true;
            return false;
        }
        

    }

    function getRefId( name ) {
        return singular(name.toUpperCase()) + "_ID";
    }

    function recognize( input ) {
        if( ddl.ddl != null )
            ddl = ddl.ddl;
           var ret = [];            
        var path = [];
        var lines = input.split("\n");
        var lineNo = -1;
        for( var i = 0; i < lines.length; i++ ) {
            var line = lines[i];
            if( "\n" == line.trim() )
                continue;
            if( line.trim().startsWith('--') )
                continue;
            if( line.trim().startsWith('#') ) {
                for( var j = i+1; j < lines.length; j++ ) {
                    var l = lines[j];
                    if( "\n" == l.trim() ) {
                        i = j;
                        break;
                    }
                    if( l.startsWith('--') ) {
                        i = j;
                        break;
                    }
                    if( l.startsWith('#') ) {
                        break;
                    }
                    line += " "+l;
                    i = j;	
                    if( l.trim().endsWith('}') ) {
                        break;
                    }
                }
                setOptions(line);
                continue;
            }
            lineNo++;
            line = line.replace(/\r/g,'');
            var nc = line.replace(/\r/g,'').replace(/ /g,'');
            //if( /[^a-zA-Z0-9="{}\/.,_\-\[\]]/.test(nc) ) 
                //continue;
            if( "" == nc ) 
                continue;
            var node = new ddlnode(lineNo,line,null);  // node not attached to anything
            var matched = false;
            for( var j = 0; j < path.length; j++ ) {
                var cmp = path[j];
                if( node.apparentDepth() <= cmp.apparentDepth() ) {
                    if( 0 < j ) {
                        var parent = path[j-1];
                        node = new ddlnode(lineNo,line,parent);  // attach node to parent
                        path[j] = node;
                        path = path.slice(0, j+1);
                        matched = true;
                        break;
                    } else {
                        path[0] = node;
                        path = path.slice(0, 1);
                        ret.push(node);
                        matched = true;
                    }
                } 
            }
            if( !matched ) {
                if( 0 < path.length ) {
                    var parent = path[path.length-1];
                    node = new ddlnode(lineNo,line,parent);
                 }
                path.push(node);
                if( node.apparentDepth() == 0 )
                    ret.push(node);
            }
        }
        
        return ret;
    }

    function setOptions( line ) {
        if( line.startsWith('#') )
            line = line.substring(1).trim();
        const eqPos = line.indexOf('=');
        let tmp = line.substring(eqPos + 1).trim();
        if( tmp.indexOf('{') < 0 ) {
            tmp = '{' + line + '}';
        }
        let json = "";
        let src= lexer( tmp, true, true, "" );
        for( i in src ) {
            let t = src[i];
            if( t.type == "identifier" 
               && t.value != "true"
               && t.value != "false"
               && t.value != "null"
            )
                json += '"'+t.value+'"';
            else
                json += t.value;	
        }
        let settings = JSON.parse(json);
        for( let x in settings ) {
            ddl.setOptionValue(x.toLowerCase(),settings[x]);
        }		
    }


    return recognize;
}());

exports.tree = tree;
