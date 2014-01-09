package com.caigen100.hadoop.crawler;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import junit.framework.Test;
import junit.framework.TestCase;
import junit.framework.TestSuite;

/**
 * Unit test for simple App.
 */
public class AppTest 
    extends TestCase
{
    /**
     * Create the test case
     *
     * @param testName name of the test case
     */
    public AppTest( String testName )
    {
        super( testName );
    }

    /**
     * @return the suite of tests being tested
     */
    public static Test suite()
    {
        return new TestSuite( AppTest.class );
    }

    /**
     * Rigourous Test :-)
     */
    public void testApp()
    {
        assertTrue( true );
    }
    
    /**
     * test regex
     */

    public void testRegex(){
        String regex_time_prefix = "\\[(\\d{4}\\-\\d{2}\\-\\d{2}).*?";
        Pattern p = Pattern.compile(regex_time_prefix + "crawl.*?http:\\/\\/(.*?)/.*?finish.*?cost:(\\d+)ms");
        String log = "[2014-01-07 09:48:15.547] [DEBUG] crawling - crawl http://www.amazon.cn/product-reviews/B003LSTZ9U/ref=cm_cr_pr_btm_link_next_7/475-6564396-0431817?ie=UTF8&pageNumber=7&showViewpoints=0&sortBy=bySubmissionDateDescending finish, proxy:undefined, cost:3443ms";
        Matcher m = p.matcher(log);
        //System.err.println(s);
        if(m.find()){
            int count = m.groupCount();
            System.out.println("group count is "+count);
            for(int i=0;i<=count;i++){
                System.out.println(m.group(i));
            }
        }else System.err.println("no match"); 
        assertTrue(m.groupCount()==3);
    }   
}
