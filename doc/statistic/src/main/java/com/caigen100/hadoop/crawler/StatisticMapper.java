/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package com.caigen100.hadoop.crawler;

import java.io.IOException;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.hadoop.io.IntWritable;
import org.apache.hadoop.io.LongWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Mapper;

/**
 *
 * @author james
 */
public class StatisticMapper extends Mapper<LongWritable, Text, Text, IntWritable>{
    private final static IntWritable one = new IntWritable(1);
    private final Text word = new Text();
    private String regex_time_prefix = "^\\[(\\d{4}\\-\\d+\\-\\d+).*?";
    private Map<String,Pattern> count_pattern = new HashMap(){
        {
            put("newurl",Pattern.compile(regex_time_prefix + "new.*?url:.*?http://(.*?)/.*$"));//date,domain
            put("downloaded",Pattern.compile(regex_time_prefix + "crawl.*?http://(.*?)/.*?finish,.*?cost:(\\d+)ms$"));//date,domain,cost
            put("exception40x",Pattern.compile(regex_time_prefix + "url:http://(.*?)/.*?status.*?code:.*?4\\d+$"));//date,domain
            put("exception50x",Pattern.compile(regex_time_prefix + "url:http://(.*?)/.*?status.*?code:.*?5\\d+$"));//date,domain
            put("exception_short_content",Pattern.compile(regex_time_prefix + "Too.*?little.*?content:http://(.*?)/.*$"));
            put("exception_lack_keywords",Pattern.compile(regex_time_prefix + "http://(.*?)/.*?lacked.*?keyword:.*$"));
            put("crawling_fail",Pattern.compile(regex_time_prefix + "give.*?up.*?crawl.*?:http://(.*?)/.*$"));
            put("exception_retry",Pattern.compile(regex_time_prefix + "Retry.*?url:.*?http://(.*?)/.*$"));
            put("invalidation",Pattern.compile(regex_time_prefix + "invalidate.*?content.*?http://(.*?)/.*$"));
        }
    };
    
    private Map<String,Pattern> sum_pattern = new HashMap(){
        {
            put("downloaded",Pattern.compile(regex_time_prefix + "crawl.*?http://(.*?)/.*?finish,.*?cost:(\\d+)ms$"));//date,domain,cost
        }
    };
    
    
    private String getYesterdayStr(){
        DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd");
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DATE, -1);
        return dateFormat.format(cal.getTime());
    }        
            
    @Override
    public void map(LongWritable key, Text value, Context context)throws IOException, InterruptedException {
        String line = value.toString();
        for (Map.Entry entry : count_pattern.entrySet()) {
            Object k = entry.getKey();
            Object v = entry.getValue();
            String label = k.toString();
            Pattern p = (Pattern)v;
            Matcher m = p.matcher(line);
            if(m.find()){
            int count = m.groupCount();
            if(count==3){
            
            }
            System.out.println("group count is "+count);
                for(int i=0;i<=count;i++){
                    System.out.println(m.group(i));
                }
            }
        }
        word.set("");
        context.write(word,one);
    }
}
