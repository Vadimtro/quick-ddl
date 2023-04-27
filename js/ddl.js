//console.log('In ddl', module);

const tree= require('./tree').tree;

const ddl = (function () {
    function DDL() {
        this.identityDataType = '12c Identity data types';
        this.defaultOptions = { 
            apex: {label: "APEX", value:'no',check:['yes','no']},
            api: {label: "Table API", value:'no',check:['yes','no']},
            //columnNamePrefix: "?",
            prefix: {label: "Object Prefix", value:"" },
            schema: {label: "Schema", value:"", },
            ondelete: {label: "On Delete", value:'Cascade',check:['cascade','restrict','set null']},
            genpk: {label:"Auto Primary Key", value:'yes',check:['yes','no']},
            pk: {label: "Primary Key Maintenance", value: this.identityDataType,check:[this.identityDataType,'Via triggers and GUIDs']},
            compress: {label: "Table Compression", value:'no',check:['yes','no']},
            drop: {label: "Include Drops", value:'no',check:['yes','no']},
            auditcols: {label: "Audit Columns", value:'no',check:['yes','no']},
            rowversion: {label: "Row Version Number", value:'no',check:['yes','no']},
            //"Auxiliary Columns": {label: "Auxiliary Columns", value:''}, // e.g. security_group_id integer
            date: {label: "Date Data Type", value:'DATE',check:['DATE','TIMESTAMP','Timestamp with time zone','Timestamp with local time zone']},
            semantics: {label: "Character Strings", value:'Default',check:['BYTE','CHAR','Default']},
            language: {label: "Data Language", value:'EN',check:['EN','JP','KO']},
            dv: {label: "Duality View", value:'yes',check:['yes','no']},
        };
        this.options = this.defaultOptions;
        this.forest = null;

        this.optionEQvalue = function( key, value ) {
            var v = this.getOptionValue(key);
            if( v == null )
                return false;
            if( v == value )
                return true;	
            if( v == true )
                return true;	
            if( v == false )
                return false;	
            if( v.toUpperCase() == value.toUpperCase() )
                return true;	
            return false;	
        }
        this.getOptionValue = function( kEy ) {
            let key = kEy.toLowerCase(); 
            var option = this.options[key];
            if( !(key in this.options) ) {
                for( let x in this.options ) {
                    const label = this.options[x].label;
                    if( label == kEy )
                        option = this.options[x];
                }		
            }
            if( option == null ) 
                return null;
            return option.value;
        }
        this.setOptionValue = function( kEy, value ) {
            let key = kEy.toLowerCase(); 
            var option = this.options[key];
            if( !(key in this.options) ) {
                for( let x in this.options ) {
                    const label = this.options[x].label;
                    if( label == kEy ) {
                        this.options[x].value = value;
                        return;
                    }
                }
                return;		
            }
            this.options[key].value = value;
        }

        this.resetOptions = function() {
            this.options = {};
            for( let x in this.defaultOptions ) {
                this.options[x] = {
                    label: this.defaultOptions[x].label,
                    value: this.defaultOptions[x].value,
                    check: this.defaultOptions[x].check,
                };
            }
        }


        this.semantics = function() {
            var char = "";
            if( this.optionEQvalue("semantics",'CHAR') )
                char = ' char';
            else if( this.optionEQvalue("semantics",'BYTE') )
                char = ' byte';
            return char;	
        }

                
        this.find = function( name ) {
            for( var i = 0; i < this.forest.length; i++ ) {        	
                var descendants = this.forest[i].descendants();
                for( var j = 0; j < descendants.length; j++ ) {
                    var node = descendants[j];
                    if( node.parseName() == name )
                        return node;
                    else if( node.parseName('noprefix=>true') == name )
                        return node;
                }
            }
            return null;
        };
        this.translate = function (input) {
            this.resetOptions();

            var output = '';

            this.forest = tree(input);

            var descendants = this.descendants();

            if( this.optionEQvalue("Include Drops",'yes') )
                for( var i = 0; i < descendants.length; i++ ) {
                    let drop = descendants[i].generateDrop();
                    if( drop != "" )
                        output += drop;
                }

            for( var i = 0; i < this.forest.length; i++ ) {
                output += this.forest[i].toDDL()+'\n';
            }

            for( var i = 0; i < descendants.length; i++ ) {
                let trigger = descendants[i].generateTrigger();
                if( trigger != "" )
                    output += trigger +'\n';
            }

            if( this.optionEQvalue("api",'yes') )
                for( var i = 0; i < descendants.length; i++ ) {
                    let tapi = descendants[i].generateTAPI();
                    if( tapi != "" )
                        output += tapi +'\n';
                }

            for( var i = 0; i < this.forest.length; i++ ) {
                let view = this.forest[i].generateView();
                if( view != "" )
                    output += view +'\n';
            }

            for( var i = 0; i < this.forest.length; i++ ) {
                let data = this.forest[i].generateData();
                if( data != "" )
                    output += data+'\n';
            }

            return output;
        }; 
        this.descendants = function () { 
            var ret = [];
            for( var i = 0; i < this.forest.length; i++ ) {
                ret = ret.concat(this.forest[i].descendants());
            }
            return ret;
        }

        this.optionsPopup = function () { 
            if (!window.focus ) return true;
            
            //window.inputEditor.options.disableInput = true;
            window.outputEditor.setValue("");
                        
            var modal = document.getElementById('options');

               window.onclick = function(event) {
                if (event.target == modal) {
                    modal.style.display = "none";
                       ddl.resetOptions();
                }
            };
            var span = document.getElementsByClassName("close")[0];
            span.onclick = function() {
                   modal.style.display = "none";
                   ddl.resetOptions();
               };
            modal.style.display = "block";
            
            return true; 
        }; 
        
        this.createOptions = function( t ) {
            for( var key in this.options ) {
                if( this.options.hasOwnProperty(key) ) {
                    //console.log(key + " -> " + p[key]);
                    var row = t.insertRow(-1);
                    var cell0 = row.insertCell(0);
                    var l = window.document.createElement("label");
                    l.innerHTML = this.options[key].label;
                    cell0.appendChild(l);
                    var cell1 = row.insertCell(1);
                    var i = window.document.createElement("input");
                    i.type = "text";
                    if( this.options[key].check != undefined ) {
                        i = window.document.createElement("select");
                        var values = this.options[key].check;
                        for( var j = 0; j < values.length; j++ ) {
                            var o = window.document.createElement("option");
                            o.text = values[j];
                            i.add(o);
                        }
                    }
                    i.value = this.options[key].value;
                    i.name = key;
                    i.id = key;
                    cell1.appendChild(i);
                    var cell2 = row.insertCell(2);
                    var b = window.document.createElement("button");
                    b.id = key;
                    b.className = "helpButton";
                    b.textContent = '?';
                    b.onclick = function( event ){ddl.helpPopup(event);};
                    b.style.alignContent="left";
                    cell2.appendChild(b);
                }
            }
        };
        
        this.additionalColumns = function() {
               var ret = []; 
               var input = this.getOptionValue('Auxiliary Columns');
            if( input == null )
                return ret;
            var tmps = input.split(',');
            for( var i = 0; i < tmps.length; i++ ) {
                var attr = tmps[i].trim();
                var type = 'VARCHAR2(4000)';
                var pos = attr.indexOf(' ');
                if( 0 < pos ) {
                    type = attr.substring(pos+1).toUpperCase();
                    attr = attr.substring(0,pos);
                }
                ret[attr] = type;
            }
            return ret;    		
        };
        
        /*this.saveDocumentOptions = function() {
               var modal = document.getElementById('options');    		
               modal.style.display = "none";
               
               var options = this.options;
            for( var key in options ) {
                if( options.hasOwnProperty(key) ) {
                    options[key].value = document.getElementById(key).value;
                }
            }
        };
        this.resetDocumentOptions = function() {
               var modal = document.getElementById('options');    		
               modal.style.display = "none";
               
               var options = this.options;
            for( var key in options ) {
                if( options.hasOwnProperty(key) ) {
                    document.getElementById(key).value = options[key].value;
                }
            }
        };*/   	
        
        this.examplesPopup = function () { 
            if (!window.focus ) return true;

            window.open('syntax_and_examples.html');
        };
        
        this.helpPopup = function ( event ) { 
            if (!window.focus ) return true;
            
            var modal = document.getElementById('help');

               window.onclick = function(event) {
                if (event.target == modal) {
                    modal.style.display = "none";
                }
            };
            var span = document.getElementsByClassName("close1")[0];
            span.onclick = function() {
                   modal.style.display = "none";
               };
            modal.style.display = "block";

            var file = event.currentTarget.id.replace(/ /g,'_');
            this.readFile("help/"+file+".html");

            return true; 
        }; 
        this.readFile = function (file)
        {
            var rawFile = new XMLHttpRequest();
            rawFile.open("GET", file, false);
            rawFile.onreadystatechange = function () {
                if( rawFile.readyState === 4 ) {
                    if(rawFile.status === 200 || rawFile.status == 0) {
                        var allText = rawFile.responseText;
                        var helptxt = document.getElementById('help-body');
                        helptxt.innerHTML = '<div id="help-body" class="help-body"><font color=blue>'+allText+'</font></div>';
                    }
                }
            };
            rawFile.send(null);
        }

        
           this.objPrefix = function () {
               var ret = this.getOptionValue("schema");
            if( ret == null )
                ret = '';
               if( '' != ret  )
                   ret = ret + '.';
            var value = "";
            if( this.getOptionValue("prefix") != null )
                value = this.getOptionValue("prefix");
               ret = ret + value;
               if( value != '' )
                   ret = ret + '_';
               return ret.toUpperCase();
           }
       
        this.tree = function ( input, table ) {
            var forest = tree(input);
            try {
                table.innerHTML = "";
                try {
                    for( var i = 0; i < forest.length; i++ )
                        forest[i].render(table, 0);
                } catch (err) {
                    var row = table.insertRow(-1);
                    var cell = row.insertCell(0);
                    cell.innerHTML = "<html><font color=red>" + err;
                }
            } catch (error) {
                console.log("Error parsing string statement.->" + error);
            }
        }

    }

    return new DDL(); 
}());

exports.ddl = ddl;
//module.exports.ddl = ddl;


function singular( name ) {
    if( name == null 
     //|| ddl.options["Duality View"].value != 'yes'    // identity columns in JSON document are singular
    )
        return name;
    if( name.toUpperCase().endsWith('ES') )
        return name.substring(0,name.length-1);
    if( name.toUpperCase().endsWith('S') )
        return name.substring(0,name.length-1);
    return name;	
}

