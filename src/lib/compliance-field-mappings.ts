/** Reviewed first-row/profile targets only. Financial/event columns require explicit evidence. */
export const complianceFieldMappings: Record<string,Record<string,string>> = {
  'compliance-06': {'0:field-1':'name','0:field-2':'father','0:field-4':'designation'},
  'compliance-09': {'0:field-0':'name','0:field-2':'designation'},
  'compliance-10': {'0:field-1':'name','0:field-2':'father','0:field-3':'gender'},
  'compliance-11': {'0:field-1':'name','0:field-3':'designation'},
  'compliance-12': {'0:field-1':'name','0:field-2':'father','0:field-3':'designation'},
  'compliance-13': {'0:field-1':'name','0:field-2':'father','0:field-3':'designation'},
  'compliance-21': {'0:field-1':'name','0:field-2':'father','0:field-3':'designation'},
  'compliance-22': {'0:field-0':'employerName','0:field-1':'employerName','0:field-5':'employeeCode','0:field-8':'gender','0:field-10':'dob','0:field-14':'joining','0:field-15':'designation','0:field-21':'mobile','0:field-22':'uan','0:field-23':'pan','0:field-27':'esic','0:field-28':'aadhaar','0:field-29':'bankAccount','0:field-31':'ifsc','0:field-33':'address'},
  'compliance-27': {'0:field-0':'employerName','0:field-1':'employerName','0:field-4':'employeeCode','0:field-9':'gender','0:field-12':'dob','0:field-16':'joining','0:field-17':'designation','0:field-20':'mobile'},
  'compliance-29': {'0:field-0':'employerName','0:field-1':'employerName','0:field-6':'employeeCode','0:field-7':'name','0:field-8':'designation'},
};