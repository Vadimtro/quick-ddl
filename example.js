const qsql= require('quick-ddl');

var fs = require('fs');
  
try {
    const file = 'timecard';
    //const file = 'department_employees';
    //console.log(file);
    const text = fs.readFileSync('./test/'+file+'.quicksql')  
    
    console.log(qsql.ddl.translate(text.toString()));    
} catch(e) {
    console.error(e);
};