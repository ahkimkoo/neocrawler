logs  = LOAD 'input/*.gz' as (line:chararray);
temp_vals = FOREACH logs GENERATE FLATTEN(REGEX_EXTRACT_ALL(line, '^.*cost:(\\d+)ms$'))  AS (cost:int);
vals = FILTER temp_vals BY NOT cost IS NULL;
--STORE vals into 'output/costs' USING PigStorage(',');
--vals  = LOAD 'output/costs' as (cost:int);
val_groups = GROUP vals ALL;
val_avg = FOREACH val_groups GENERATE group,AVG(vals.cost) AS num;
dump val_avg;