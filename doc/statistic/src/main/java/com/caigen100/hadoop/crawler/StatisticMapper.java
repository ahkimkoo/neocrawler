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
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.hadoop.io.IntWritable;
import org.apache.hadoop.io.LongWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Mapper;
import org.apache.log4j.Logger;

/**
 * statistic mapper
 * @author james
 */
public class StatisticMapper extends Mapper<LongWritable, Text, Text, IntWritable>{
    private static final Logger logger = Logger.getLogger(StatisticMapper.class);
    private final static IntWritable one = new IntWritable(1);
    private final Text word = new Text();
    private String regex_time_prefix = "^\\[(\\d{4}\\-\\d+\\-\\d+).*?";
    private Map<String,Pattern> count_pattern = new HashMap(){
        {
            put("request",Pattern.compile(regex_time_prefix + "new.*?url:.*?http://(.*?)/.*$"));//date,domain
            put("response",Pattern.compile(regex_time_prefix + "crawl.*?http://(.*?)/.*?finish,.*?cost:(\\d+)ms$"));//date,domain,cost
            put("exception40x",Pattern.compile(regex_time_prefix + "url:http://(.*?)/.*?status.*?code:.*?4\\d+$"));//date,domain
            put("exception50x",Pattern.compile(regex_time_prefix + "url:http://(.*?)/.*?status.*?code:.*?5\\d+$"));//date,domain
            put("exception_short_content",Pattern.compile(regex_time_prefix + "Too.*?little.*?content:http://(.*?)/.*$"));
            put("exception_lack_keywords",Pattern.compile(regex_time_prefix + "http://(.*?)/.*?lacked.*?keyword:.*$"));
            put("crawl_fail",Pattern.compile(regex_time_prefix + "give.*?up.*?crawl.*?:http://(.*?)/.*$"));
            put("retry",Pattern.compile(regex_time_prefix + "Retry.*?url:.*?http://(.*?)/.*$"));
            put("invalidation",Pattern.compile(regex_time_prefix + "invalidate.*?content.*?http://(.*?)/.*$"));
            put("saved",Pattern.compile(regex_time_prefix + "insert.*?content.*?http://(.*?)/.*$"));
        }
    };
    
    private Map<String,Pattern> sum_pattern = new HashMap(){
        {
            put("cost_avg",Pattern.compile(regex_time_prefix + "crawl.*?http://(.*?)/.*?finish,.*?cost:(\\d+)ms$"));//date,domain,cost
        }
    };
    
    
    private String getYesterdayStr(){
        DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd");
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DATE, -1);
        return dateFormat.format(cal.getTime());
    } 
    /**
     * transform doman to top level domain
     * e.g: www.google.com -> google.com
     * @param domain
     * @return 
     */
    public String getTopLevelDomain(String domain){
        String topDomain = domain;
        String[] domainPices = domain.split("\\.");
        if(domainPices.length>2)topDomain = domainPices[domainPices.length-2] +"."+ domainPices[domainPices.length-1];
        return topDomain;
    }
            
    @Override
    public void map(LongWritable key, Text value, Context context)throws IOException, InterruptedException {
        String line = value.toString();
        //emit count parrern matched
        for (Map.Entry entry : count_pattern.entrySet()) {
            Object k = entry.getKey();
            Object v = entry.getValue();
            String label = k.toString();
            
            if(label.equals("exception_short_content")||label.equals("exception_lack_keywords"))label="exception_oth";
            
            Pattern p = (Pattern)v;
            Matcher m = p.matcher(line);
            if(m.find()){
                int count = m.groupCount();
                if(count>=2){
                    String dateStr = m.group(1);
                    String domainStr = m.group(2);
                    domainStr =  getTopLevelDomain(domainStr);
                    String specialKey = label+"@"+dateStr+"@"+domainStr;
                    String massiveKey = label+"@"+dateStr+"@all";
                    word.set(specialKey);
                    context.write(word,one);
                    logger.debug("key: "+word+", value:"+one);
                    word.set(massiveKey);
                    context.write(word,one);
                    logger.debug("key: "+word+", value:"+one);
                }
            }
        }
        //emit sum parrern matched
        for (Map.Entry entry : sum_pattern.entrySet()) {
            Object k = entry.getKey();
            Object v = entry.getValue();
            String label = k.toString();
            Pattern p = (Pattern)v;
            Matcher m = p.matcher(line);
            if(m.find()){
                int count = m.groupCount();
                if(count>=3){
                    String dateStr = m.group(1);
                    String domainStr = m.group(2);
                    domainStr =  getTopLevelDomain(domainStr);
                    String countStr = m.group(3);
                    IntWritable quantity = new IntWritable(Integer.parseInt(countStr));
                    String specialKey = label+"@"+dateStr+"@"+domainStr;
                    String massiveKey = label+"@"+dateStr+"@all";
                    word.set(specialKey);
                    context.write(word,quantity);
                    logger.debug("key: "+word+", value:"+quantity);
                    word.set(massiveKey);
                    context.write(word,quantity);
                    logger.debug("key: "+word+", value:"+quantity);
                }
            }
        }
        
    }
}
