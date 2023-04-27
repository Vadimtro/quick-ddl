var Chance = require('chance');
var chance = new Chance();


var sample = (function(){ 
	
    function generate( table, column, type, values ) {
    	if( values != null && 0 < values.length ) {
  		  	var min = 0;
  		  	var max = values.length;
  		  	var optQuote = "'";
  		  	if(  type.startsWith('INTEGER') || type.startsWith('NUMBER') || type.startsWith('DATE')  ) 
  		  		optQuote = "";
			let value = values[Math.floor(Math.random() * (max - min)) + min];
			if( value.toLowerCase && value.toLowerCase() == 'null' )
				optQuote = "";
    		return optQuote+value+optQuote;    		
    	}
    	
    	if( column == 'NAME' && 0 <= table.indexOf('DEPARTMENT') ) {
    		var depts = ['Sales','Finance','Delivery','Manufacturing'];
  		  	var min = 0;
  		  	var max = depts.length;
    		return "'"+depts[Math.floor(Math.random() * (max - min)) + min]+"'";
    	}    	
    	
    	if( chance[column.toLowerCase()] != undefined 
    	 && column.indexOf('NAME') < 0 
    	) {
    		return "'"+chance[column.toLowerCase()]()+"'";
    	}
		if( column == 'FIRST_NAME' ) 
			return "'"+chance.first()+"'";
		if( column == 'LAST_NAME' ) 
			return "'"+chance.last()+"'";
		if( 0 <= column.indexOf('NAME') ) 
			return "'"+chance.name()+"'";

    	/*if( 0 <= column.indexOf('NAME') || 0 <= column.indexOf('OWNER') ) {
    	    return "'"+chance.last()+"'";
    	}*/
    	
    	if( 0 < column.indexOf('ADDRESS') ) {
    	    return "'"+chance.address()+"'";
    	}
    	
    	if( column == 'LOCATION') {
    	    return "'"+chance.city()+"'";
    	}

    	if( column == 'DESCRIPTION') {
    	    return "'"+chance.paragraph({sentences: 2})+"'";
    	}
    	
    	if( column == 'JOB' ) {
    		var jobs = ['Engineer','Consultant','Architect','Manager','Analyst','Specialist','Evangelist','Salesman'];
  		  	var min = 0;
  		  	var max = jobs.length;
    		return "'"+jobs[Math.floor(Math.random() * (max - min)) + min]+"'";
    	}
    	
    	if( type.startsWith('INTEGER') || type.startsWith('NUMBER') ) {
    		  var min = 0;
    		  var max = 100;
    		  return Math.floor(Math.random() * (max - min)) + min;
    	}
    	if( type.startsWith('DATE')  ) {
			  var min = 0;
			  var max = 100;
			  var offset = Math.floor(Math.random() * (max - min)) + min;
			  return 'sysdate-'+offset;  	
  		}
        return "'N/A'";
    }

    return generate;
}());


exports.sample = sample;