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

exports.singular = singular;