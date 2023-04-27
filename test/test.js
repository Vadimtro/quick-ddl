const qsql= require('quick-ddl');

var fs = require('fs');

var lexer = require('../js/lexer').lexer;

const mismatches = { 
    "FRC_PATIENTS_INSURANCE_PROVIDER_FK": "frc_patients_insurance_prov_fk", 
    "FRC_PATIENT_PROCEDURES_ID_PK": "frc_patient_proced_id_pk",
    "FRC_PATIENT_PROCEDURES_PATIENT_ID_FK": "frc_patient_pro_patient_id_fk",
    "FRC_PATIENT_PROCEDURES_I1": "frc_patient_proced_i1",
    "FRC_DOCTOR_PROCEDURES_ID_PK": "frc_doctor_procedu_id_pk",
    "MED_COVERAGE_PLAN_OPTION_ID_PK": "med_coverage_plan_id_pk2",
    "MED_COVERAGE_PLAN_OPTION_COVERAGE_PLAN_ID_FK": "med_coverage_coverage_plan_fk",
    "MED_COVERAGE_PLAN_OPTION_I1": "med_coverage_plan_i1",
    "MED_USERS_COVERAGE_PLAN_OPTION_ID_FK":"med_users_coverage_plan_opt_fk",
    "MED_COVERAGE_PLAN":"med_coverage_plan_option",     // coverage_plan_id               number /fk coverage_plan
                                                        // coverage_plan_option_id        number /fk coverage_plan   ???
    "MED_USERS_I2":"med_users_i112",
    "MED_USERS_I3":"med_users_i123",
    "MED_USER_CLAIMS_RECEIPT_FROM_ID_FK":"med_user_clai_receipt_from_fk",
    "MED_USER_CLAIM_DOCS_ID_PK":"med_user_claim_doc_id_pk",
    "MED_USER_CLAIM_DOCS_CLAIM_FK":"med_user_claim_doc_claim_fk",
    "MED_USER_CLAIM_DOCS_I1":"med_user_claim_doc_i1",
    "MED_USER_CLAIM_NOTES_ID_PK":"med_user_claim_not_id_pk",
    "MED_USER_CLAIM_NOTES_CLAIM_FK":"med_user_claim_not_claim_fk",
    "MED_USER_CLAIM_NOTES_I1":"med_user_claim_not_i1",
    "MED_USER_NOTIFICATIONS_ID_PK":"med_user_notificat_id_pk",
    "EMPLOYEES_EMPLOYEE_TYPE_CK":"employees_employee_type_vc3_ck",
}

function compareTokens( so, sc ) {
    let sccontent = sc.value.toUpperCase();
    let socontent = so.value.toUpperCase();
    if( socontent == sccontent )
        return true;
    //console.log(socontent+"=?="+sccontent);    
    if( socontent.charAt(0) == '\'' && 	sccontent.charAt(0) == '\''	)
        return true;
    if( sc.type == "constant.numeric" && so.type == "constant.numeric" )	
        return true;
    let mismatch =  mismatches[socontent];
    if( mismatch == null )
        return false;
    if( mismatch.toUpperCase() == sccontent )
        return true;
    return false;
}
  
try {   
    const files = fs.readdirSync('./test/');
    for( let f in files ) {
        let file = files[f];
        if( !file.endsWith('.quicksql') )
            continue;

        //if( file != 'medipay.quicksql' )
            //continue;   

        console.log(file);   

        file = file.substring(0, file.indexOf('.'));

        const text = fs.readFileSync('./test/'+file+'.quicksql').toString();  

        const output = qsql.ddl.translate(text);    
    
        let cmp = fs.readFileSync('./test/'+file+'.sql').toString(); 

        cmp = cmp.replaceAll("default on null '0'",'default on null  0 ');
    
        let so= lexer( output, false, true, "" );
        let sc= lexer( cmp, false, true, "" );
        let i = 0;
        while (i < so.length && i < sc.length ) {
            if( !compareTokens(so[i], sc[i]) ) {
                //var linec = Service.charPos2LineNo(cmp, sc[i].begin);
                //var linecOffset = Service.lineNo2CharPos(cmp, linec);
                //var lineo = Service.charPos2LineNo(output, so[i].begin);
                //var lineoOffset = Service.lineNo2CharPos(output, lineo);
                console.error("Test# "+file+" : Mismatch at offset# "+so[i].begin+ "("+sc[i].begin+")");
                console.error(output.substring(so[i-3].end,so[i].end)+"...");
                console.error(cmp.substring(sc[i-3].end,sc[i].end)+"...");
                return false;
            }
            i++;
        }
        if( so.length != sc.length ) {
            console.error("lenghth mismatch output="+so.length+" cmp="+sc.length)
        }
    }

    const file = 'forrestclinic';
    //const file = 'department_employees';

    console.log("All tests are OK")

} catch(e) {
    console.error(e);
};

