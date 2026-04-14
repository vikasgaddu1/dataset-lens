libname test "C:\sas\Test_Ext";
/* ============================================================
   Sample dataset generator for VS Code extension testing
   - >100 observations (set with &NOBS)
   - Numeric, character, date, time, datetime
   - ISO 8601 character date/time strings
   - A few long text columns and categorical vars
   - Reproducible randomness (seeded)
   ============================================================ */

%let NOBS = 12000;   /* Change this if you want more/less rows */

/* Create the dataset in WORK by default */
data test.big_test_dataset(label = "BIG TEST DATASET");
    call streaminit(20250924);  /* Seed for reproducibility */

    length 
        USUBJID       $12
        STUDYID       $10
        ARM           $12
        COUNTRY       $3
        DESC_SHORT    $60
        DESC_LONG     $300
        CDATE_ISO     $10   /* yyyy-mm-dd */
        CTIME_ISO     $12   /* hh:mm:ss */
        CDATETIME_ISO $19   /* yyyy-mm-ddThh:mm:ss */
        NOTE          $200
        CHAR_MIXED    $40
    ;

    label
        ID              = "Row ID"
        STUDYID         = "Study Identifier"
        USUBJID         = "Unique Subject Identifier"
        ARM             = "Treatment Arm"
        COUNTRY         = "Country Code"
        VISITNUM        = "Visit Number"
        RAND_NUM        = "Random Uniform(0,1)"
        RAND_INT        = "Random Integer 0-100"
        NORM_SCORE      = "Normal(Mean 50, SD 10)"
        AMT_USD         = "Amount in USD"
        PCT             = "Percentage Value"
        FLAG_YN         = "Y/N Character Flag"
        FLAG01          = "Binary Flag 0/1"
        START_DATE      = "Start Date (SAS date)"
        END_DATE        = "End Date (SAS date)"
        START_TIME      = "Start Time (SAS time)"
        START_DTTM      = "Start Datetime (SAS datetime)"
        END_DTTM        = "End Datetime (SAS datetime)"
        CDATE_ISO       = "Start Date (ISO8601 char)"
        CTIME_ISO       = "Start Time (ISO8601 char)"
        CDATETIME_ISO   = "Start Datetime (ISO8601 char)"
        DESC_SHORT      = "Short Description"
        DESC_LONG       = "Long Description / Lorem"
        NOTE            = "Misc Notes"
        CHAR_MIXED      = "Mixed Alnum String"
        AGE             = "Age (years)"
        HEIGHT_CM       = "Height (cm)"
        WEIGHT_KG       = "Weight (kg)"
        BMI             = "Body Mass Index"
        SCORE1          = "Score 1"
        SCORE2          = "Score 2"
        SCORE3          = "Score 3"
        VISIT_WINDOW    = "Visit Window (days)"
        ;
    
    format
        START_DATE END_DATE date9.
        START_TIME time8.
        START_DTTM END_DTTM datetime19.
        AMT_USD dollar12.2
        PCT percent8.2
        BMI 6.2
        SCORE1-SCORE3 8.2
        ;

    /* Prebuild some reference arrays/lists */
    array countries[5] $3 _temporary_ ('USA','CAN','DEU','IND','AUS');
    array arms[3]      $12 _temporary_ ('Placebo','LowDose','HighDose');

    /* Generate NOBS rows */
    do ID = 1 to &NOBS;

        /* Stable identifiers/categoricals */
        STUDYID   = cats('STUDY', put(1 + mod(ID, 3), z2.));
        USUBJID   = cats('SUBJ-', put(ID, z4.));
        ARM       = arms[1 + mod(ID, dim(arms))];
        COUNTRY   = countries[1 + mod(ID, dim(countries))];

        /* Visit numbering and window */
        VISITNUM      = 1 + mod(ID, 12);
        VISIT_WINDOW  = ceil(rand('Uniform')*28) - 14; /* -14 .. +14 days */

        /* Numeric fields */
        RAND_NUM  = rand('Uniform');               /* 0..1 */
        RAND_INT  = floor(rand('Uniform')*101);    /* 0..100 */
        NORM_SCORE= rand('Normal', 50, 10);        /* ~N(50,10^2) */
        AMT_USD   = round(rand('Uniform')*10000, 0.01);
        PCT       = rand('Uniform');               /* formatted as percent */

        /* Demographics + derived BMI */
        AGE       = 18 + floor(rand('Uniform')*63);     /* 18..80 */
        HEIGHT_CM = round(150 + rand('Normal', 0, 10) + mod(ID, 15), .1);
        WEIGHT_KG = round(50  + rand('Normal', 0, 8)  + mod(ID, 20), .1);
        BMI       = WEIGHT_KG / ( (HEIGHT_CM/100)**2 );

        /* Flags (char and numeric) */
        FLAG_YN   = ifc(rand('Bernoulli', 0.6)=1, 'Y','N');
        FLAG01    = rand('Bernoulli', 0.6);

        /* Dates/Times (SAS numeric date/time/datetime) */
        /* Start at 01JAN2020 and vary by ID and visit window */
        START_DATE = '01JAN2020'd + ID + VISIT_WINDOW;
        END_DATE   = START_DATE + ceil(rand('Uniform')*7);  /* follow-up within a week */

        /* Time and datetime */
        START_TIME = hms(mod(ID, 24), mod(ID*3, 60), mod(ID*7, 60));
        START_DTTM = dhms(START_DATE, hour(START_TIME), minute(START_TIME), second(START_TIME));
        END_DTTM   = START_DTTM + (60*60*rand('Uniform')*72); /* add up to 72 hours */

        /* ISO 8601 character versions */
        CDATE_ISO     = put(START_DATE, e8601da.);
        CTIME_ISO     = put(START_TIME, e8601tm.);
        CDATETIME_ISO = put(START_DTTM, e8601dt.);

        /* Text columns */
        DESC_SHORT = catx(' '
            , 'Row', put(ID, best.)
            , '-', ARM, 'visit', put(VISITNUM, best.)
            , 'on', CDATE_ISO
        );

        DESC_LONG = catx(' '
            , 'This is a longer paragraph of synthetic test data for subject', USUBJID
            , 'in', STUDYID||'.'
            , 'They were randomized to', ARM||','
            , 'based in', COUNTRY||'.'
            , 'Start datetime:', CDATETIME_ISO||'.'
            , 'Amount:', put(AMT_USD, dollar12.2)||','
            , 'Percent:', put(PCT, percent8.2)||'.'
            , 'BMI:', put(BMI, 6.2)||'.'
            );

        NOTE = ifc(mod(ID, 5)=0, 
                   'Special case: QC needed for this row due to schedule deviation.',
                   'No issues noted.');

        /* Mixed alphanumeric string (useful to test parsing) */
        CHAR_MIXED = cats(
            byte(65 + mod(ID, 26)),             /* A..Z cycling */
            put(ceil(RAND_INT), z3.),           /* zero-padded number */
            '-', lowcase(scan(ARM, 1)),         /* arm token */
            '-', COUNTRY
        );

        /* A few computed scores */
        SCORE1 = round(NORM_SCORE * RAND_NUM, .01);
        SCORE2 = round(PCT * 100 + rand('Normal', 0, 2), .01);
        SCORE3 = round(BMI + RAND_NUM*2 - 1, .01);

        /* Introduce some missing values to test edge cases */
        if mod(ID, 17)=0 then do;
            DESC_LONG = 'MISSING LONG DESCRIPTION FOR TESTING.';
            AMT_USD   = .;
        end;
        if mod(ID, 29)=0 then do;
            START_DATE   = .;
            CDATE_ISO    = '';
        end;
        if mod(ID, 37)=0 then do;
            START_DTTM    = .;
            CDATETIME_ISO = '';
        end;

        output;
    end;
run;

/* Quick sanity checks (optional) */
proc contents data=test.big_test_dataset varnum; run;
proc print data=test.big_test_dataset (obs=10); run;

/* ============================================================
   OPTIONAL: also create an XPT (v5 transport) file on disk.
   Uncomment and set a path if you want to test XPT reading.
   ============================================================ */
/*
filename xptfile "C:\temp\big_test_dataset.xpt";
libname xptout xport xptfile;

proc copy in=work out=xptout memtype=data;
    select big_test_dataset;
run;

libname xptout clear;
filename xptfile clear;
*/
