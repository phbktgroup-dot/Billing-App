export const validateITRData = (itrType: string, profile: any, financialData: any) => {
  const errors: string[] = [];

  // Fetch saved ITR data for deeper validation
  let itrData: any = {};
  if (profile?.business_id) {
    const savedData = localStorage.getItem(`itr_data_${profile.business_id}`);
    if (savedData) {
      try {
        itrData = JSON.parse(savedData);
      } catch (e) {
        console.error("Failed to parse saved ITR data");
      }
    }
  }

  // Basic Profile Validation
  if (!profile?.name) {
    errors.push("Name is required in your profile.");
  }
  
  if (!profile?.pan) {
    errors.push("PAN is required in your profile.");
  } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(profile.pan.toUpperCase())) {
    errors.push("Invalid PAN format. Must be 5 letters, 4 numbers, 1 letter (e.g., ABCDE1234F).");
  }

  if (!profile?.phone || !/^[0-9]{10}$/.test(profile.phone)) {
    errors.push("Valid 10-digit mobile number is required in your profile.");
  }

  if (!profile?.email || !/^\S+@\S+\.\S+$/.test(profile.email)) {
    errors.push("Valid email address is required in your profile.");
  }

  if (!profile?.city) {
    errors.push("City is required in your profile address.");
  }
  
  if (!profile?.pincode || !/^[0-9]{6}$/.test(profile.pincode)) {
    errors.push("Valid 6-digit Pincode is required in your profile.");
  }

  // ITR Profile Validation
  if (!itrData.firstName && !['itr5', 'itr6', 'itr7'].includes(itrType)) {
    errors.push("First Name is required in ITR Profile.");
  }

  if (!itrData.dobOrFormationDate) {
    errors.push("Date of Birth / Formation is required in ITR Profile.");
  }

  if (!itrData.bankAccountNo) {
    errors.push("Bank Account Number is required in ITR Profile.");
  }

  if (!itrData.ifscCode) {
    errors.push("IFSC Code is required in ITR Profile.");
  }

  if (!itrData.fatherName && !['itr5', 'itr6', 'itr7'].includes(itrType)) {
    errors.push("Father's Name is required in ITR Profile.");
  }

  // Business specific validation
  if (['itr3', 'itr4', 'itr5', 'itr6', 'itr7'].includes(itrType)) {
    if (!profile?.business_name && !itrData.tradeName) {
      errors.push(`Business Name / Trade Name is required for ${itrType.toUpperCase()}.`);
    }
    if (!itrData.natureOfBusinessCode) {
      errors.push(`Nature of Business Code is required for ${itrType.toUpperCase()}.`);
    }
  }

  if (itrType === 'itr6' && !itrData.cinNumber) {
    errors.push("CIN Number is required for ITR-6.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const generateITRJson = (itrType: string, profile: any, financialData: any) => {
  const date = new Date();
  const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  
  const { totalSales, totalPurchases, totalExpenses, netProfit } = financialData;

  let itrData: any = {};
  let portalDocs: any = {};
  if (profile?.business_id) {
    const savedData = localStorage.getItem(`itr_data_${profile.business_id}`);
    if (savedData) {
      try {
        itrData = JSON.parse(savedData);
      } catch (e) {
        console.error("Failed to parse saved ITR data");
      }
    }
    const savedDocs = localStorage.getItem(`portal_docs_${profile.business_id}`);
    if (savedDocs) {
      try {
        portalDocs = JSON.parse(savedDocs);
      } catch (e) {
        console.error("Failed to parse portal docs");
      }
    }
  }

  const baseCreationInfo = {
    "SWVersionNo": "1.0",
    "SWCreatedBy": "SW-123456",
    "JSONCreatedBy": "TaxApp",
    "JSONCreationDate": formattedDate,
    "IntermediaryCity": profile?.city || "City",
    "PortalDocumentsAttached": Object.keys(portalDocs).map(key => ({
      "Type": key.toUpperCase(),
      "FileName": portalDocs[key].name,
      "UploadDate": portalDocs[key].date
    }))
  };

  const personalInfo = {
    "FirstName": itrData.firstName || profile?.name?.split(' ')[0] || "User",
    "MiddleName": itrData.middleName || "",
    "LastName": itrData.lastName || profile?.name?.split(' ').slice(1).join(' ') || "Name",
    "PAN": profile?.pan || "ABCDE1234F",
    "DOB": itrData.dobOrFormationDate || "1990-01-01",
    "Gender": itrData.gender || "M",
    "AadharNumber": itrData.aadharNumber || "",
    "Address": {
      "ResidenceNo": itrData.flatDoorBlock || "123",
      "ResidenceName": itrData.premisesBuilding || "",
      "RoadOrStreet": itrData.roadStreet || profile?.address || "Street",
      "LocalityOrArea": itrData.areaLocality || "",
      "CityOrTownOrDistrict": profile?.city || "City",
      "StateCode": profile?.state?.split('-')[0] || "27",
      "CountryCode": "91",
      "PinCode": profile?.pincode || "400001"
    },
    "ContactInfo": {
      "MobileNo": profile?.phone || "9999999999",
      "EmailAddress": profile?.email || "user@example.com"
    }
  };

  const filingStatus = {
    "ReturnFileSec": itrData.filingStatus || "11",
    "ResidentialStatus": itrData.residentialStatus || "RES"
  };

  const verification = {
    "DeclarationName": profile?.name || "User Name",
    "DeclarationFatherName": itrData.fatherName || "Father Name",
    "Place": profile?.city || "City",
    "Date": formattedDate,
    "Capacity": "Self"
  };

  const auditInfo = {
    "AreYouLiableForAudit": itrData.liableForAudit === 'Yes' ? 'Y' : 'N',
    ...(itrData.liableForAudit === 'Yes' ? {
      "AuditorName": itrData.auditorName || "",
      "AuditorMembershipNo": itrData.auditorMembershipNo || "",
      "DateOfAuditReport": itrData.dateOfAuditReport || ""
    } : {})
  };

  const bankDetails = {
    "BankAccountNo": itrData.bankAccountNo || "1234567890",
    "IFSCCode": itrData.ifscCode || "SBIN0000001",
    "BankName": itrData.bankName || "State Bank of India"
  };

  let formContent: any = {};

  switch (itrType) {
    case 'itr1':
      formContent = {
        "FormName": "ITR-1",
        "Description": "For individuals being a resident having total income upto Rs.50 lakh, having Income from Salaries, one house property, other sources (Interest etc.), and agricultural income upto Rs.5 thousand",
        "AssessmentYear": "2026",
        "SchemaVer": "1.0",
        "FormVer": "1.0",
        "PartA_GEN1": {
          "PersonalInfo": personalInfo,
          "FilingStatus": filingStatus
        },
        "PartB_TI": {
          "GrossSalary": 0,
          "IncomeFromHouseProperty": 0,
          "IncomeFromOtherSources": netProfit > 0 ? netProfit : 0,
          "GrossTotalIncome": netProfit > 0 ? netProfit : 0
        },
        "PartC_Deductions": {
          "Section80C": 0,
          "TotalDeductions": 0
        },
        "PartD_ComputationOfTax": {
          "TotalIncome": netProfit > 0 ? netProfit : 0,
          "TaxPayable": 0
        },
        "Verification": verification
      };
      break;
    case 'itr2':
      formContent = {
        "FormName": "ITR-2",
        "Description": "For Individuals and HUFs not having income from profits and gains of business or profession",
        "AssessmentYear": "2026",
        "SchemaVer": "1.0",
        "FormVer": "1.0",
        "PartA_GEN1": {
          "PersonalInfo": personalInfo,
          "FilingStatus": filingStatus
        },
        "PartB_TI": {
          "GrossSalary": 0,
          "IncomeFromHouseProperty": 0,
          "CapitalGains": 0,
          "IncomeFromOtherSources": netProfit > 0 ? netProfit : 0,
          "GrossTotalIncome": netProfit > 0 ? netProfit : 0
        },
        "PartB_TTI": {
          "ComputationOfTaxLiability": {
            "TaxPayableOnTotalIncome": 0,
            "RebateUnderSection87A": 0,
            "Surcharge": 0,
            "HealthAndEducationCess": 0,
            "TotalTaxSurchargeAndCess": 0,
            "TotalInterestPayable": 0,
            "TotalTaxAndInterestPayable": 0
          }
        },
        "Verification": verification
      };
      break;
    case 'itr3':
      formContent = {
        "FormName": "ITR-3",
        "Description": "For individuals and HUFs having income from profits and gains of business or profession",
        "AssessmentYear": "2026",
        "SchemaVer": "1.0",
        "FormVer": "1.0",
        "PartA_GEN1": {
          "PersonalInfo": personalInfo,
          "FilingStatus": filingStatus,
          "NatureOfBusiness": itrData.natureOfBusinessCode || "01001",
          "AuditInfo": auditInfo,
          "BankDetails": bankDetails
        },
        "PartB_TI": {
          "ProfitsAndGainsFromBusiness": netProfit > 0 ? netProfit : 0,
          "GrossTotalIncome": netProfit > 0 ? netProfit : 0,
          "TotalIncome": netProfit > 0 ? netProfit : 0
        },
        "PartB_TTI": {
          "TaxPayableOnTotalIncome": 0,
          "TotalTaxAndInterestPayable": 0
        },
        "Schedule_BP": {
          "BusinessIncome": totalSales,
          "BusinessExpenses": totalExpenses + totalPurchases,
          "NetProfit": netProfit,
          "Depreciation": 0,
          "OtherIncomes": 0
        },
        "Schedule_PL": {
          "RevenueFromOperations": totalSales,
          "OtherIncome": 0,
          "TotalRevenue": totalSales,
          "Expenses": {
            "Purchases": totalPurchases,
            "EmployeeBenefits": 0,
            "FinanceCosts": 0,
            "Depreciation": 0,
            "OtherExpenses": totalExpenses,
            "TotalExpenses": totalExpenses + totalPurchases
          },
          "ProfitBeforeTax": netProfit
        },
        "Verification": verification
      };
      break;
    case 'itr4':
      formContent = {
        "FormName": "ITR-4",
        "Description": "For Individuals, HUFs and Firms (other than LLP) being a resident having total income upto Rs.50 lakh and having income from business and profession which is computed under sections 44AD, 44ADA or 44AE",
        "AssessmentYear": "2026",
        "SchemaVer": "1.0",
        "FormVer": "1.0",
        "PartA_GEN1": {
          "PersonalInfo": personalInfo,
          "FilingStatus": filingStatus,
          "NatureOfBusiness": itrData.natureOfBusinessCode || "01001",
          "AuditInfo": auditInfo,
          "BankDetails": bankDetails
        },
        "PartB_TI": {
          "ProfitsAndGainsFromBusiness": netProfit > 0 ? netProfit : 0,
          "GrossTotalIncome": netProfit > 0 ? netProfit : 0,
          "TotalIncome": netProfit > 0 ? netProfit : 0
        },
        "PartB_TTI": {
          "TaxPayableOnTotalIncome": 0,
          "TotalTaxAndInterestPayable": 0
        },
        "Schedule_BP": {
          "PresumptiveIncome44AD": {
            "GrossTurnover": totalSales,
            "PresumptiveIncome": Math.max(netProfit, totalSales * 0.08)
          },
          "FinancialParticulars": {
            "SundryDebtors": 0,
            "SundryCreditors": 0,
            "StockInHand": 0,
            "CashInHand": 0
          }
        },
        "Verification": verification
      };
      break;
    case 'itr5':
      formContent = {
        "FormName": "ITR-5",
        "Description": "For persons other than- (i) individual, (ii) HUF, (iii) company and (iv) person filing Form ITR-7",
        "AssessmentYear": "2026",
        "SchemaVer": "1.0",
        "FormVer": "1.0",
        "PartA_GEN1": {
          "FirmInfo": {
            "FirmName": itrData.tradeName || profile?.business_name || "Business Name",
            "PAN": profile?.pan || "ABCDE1234F",
            "DateOfFormation": itrData.dobOrFormationDate || "2020-01-01"
          },
          "FilingStatus": filingStatus,
          "NatureOfBusiness": itrData.natureOfBusinessCode || "01001",
          "AuditInfo": auditInfo,
          "BankDetails": bankDetails
        },
        "PartB_TI": {
          "ProfitsAndGainsFromBusiness": netProfit > 0 ? netProfit : 0,
          "GrossTotalIncome": netProfit > 0 ? netProfit : 0
        },
        "PartB_TTI": {
          "TaxPayableOnTotalIncome": 0,
          "TotalTaxAndInterestPayable": 0
        },
        "Verification": verification
      };
      break;
    case 'itr6':
      formContent = {
        "FormName": "ITR-6",
        "Description": "For Companies other than companies claiming exemption under section 11",
        "AssessmentYear": "2026",
        "SchemaVer": "1.0",
        "FormVer": "1.0",
        "PartA_GEN1": {
          "CompanyInfo": {
            "CompanyName": itrData.tradeName || profile?.business_name || "Company Name",
            "PAN": profile?.pan || "ABCDE1234F",
            "CIN": itrData.cinNumber || "U12345MH2020PTC123456",
            "DateOfFormation": itrData.dobOrFormationDate || "2020-01-01"
          },
          "FilingStatus": filingStatus,
          "NatureOfBusiness": itrData.natureOfBusinessCode || "01001",
          "AuditInfo": auditInfo,
          "BankDetails": bankDetails
        },
        "PartB_TI": {
          "ProfitsAndGainsFromBusiness": netProfit > 0 ? netProfit : 0,
          "GrossTotalIncome": netProfit > 0 ? netProfit : 0
        },
        "PartB_TTI": {
          "TaxPayableOnTotalIncome": 0,
          "TotalTaxAndInterestPayable": 0
        },
        "Verification": verification
      };
      break;
    case 'itr7':
      formContent = {
        "FormName": "ITR-7",
        "Description": "For persons including companies required to furnish return under sections 139(4A) or 139(4B) or 139(4C) or 139(4D) only",
        "AssessmentYear": "2026",
        "SchemaVer": "1.0",
        "FormVer": "1.0",
        "PartA_GEN1": {
          "TrustInfo": {
            "TrustName": itrData.tradeName || profile?.business_name || "Trust Name",
            "PAN": profile?.pan || "ABCDE1234F",
            "RegistrationDetails": itrData.registrationDetails || "12A Reg No.",
            "DateOfFormation": itrData.dobOrFormationDate || "2020-01-01"
          },
          "FilingStatus": filingStatus,
          "AuditInfo": auditInfo,
          "BankDetails": bankDetails
        },
        "PartB_TI": {
          "VoluntaryContributions": totalSales,
          "ApplicationOfFunds": totalExpenses,
          "GrossTotalIncome": netProfit > 0 ? netProfit : 0
        },
        "PartB_TTI": {
          "TaxPayableOnTotalIncome": 0,
          "TotalTaxAndInterestPayable": 0
        },
        "Verification": verification
      };
      break;
    default:
      formContent = {};
  }

  const rootKey = `Form_${itrType.toUpperCase()}`;
  
  return {
    "ITR": {
      "CreationInfo": baseCreationInfo,
      [rootKey]: formContent
    }
  };
};
