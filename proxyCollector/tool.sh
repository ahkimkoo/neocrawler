#
#A script to create protocol from keys and values
#
#!/usr/bin/bash
filename1="/home/caigen/olddatatest.txt"
filename2="/home/caigen/datatest.txt"
filename3="/home/caigen/output0.txt"
#filename3="$3"

echo "" > $filename3

while read -r line
do
	if grep -Fxq $line $filename1
	then
 	   echo $line 
        else
		key="$( cut -d '=' -f 1 <<< "$line" )"
    		value="$( cut -d '=' -f 2- <<< "$line" )"
                temp0="'*'""""*""3""\r\n""/$" 
		temp1="/5""\r\n""RPUSH"
		temp2="\r\n""$""${#key}""\r\n""$key""\r\n"
		temp3="$""${#value}""\r\n""$value""\r\n"
  	        echo $temp1$temp2$temp3 >> $filename3
	fi
done < $filename2

