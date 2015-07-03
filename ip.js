/* Filename: ip.js
Author: Ella Chao
Date: May 19, 2015
Goal: JavaScript for Inbox Analyzer App

Honor Code Statement:
I asked Eni for some help but all code was written by me.
*/

// MongoDB collections
Email = new Mongo.Collection('email');
From = new Meteor.Collection("from");
To = new Meteor.Collection("to");
if (Meteor.isServer){
    //global variables that store user information
    var userId;
    var gmailClients = {};
    
    Meteor.users.find().observe({
        //when a new user signs in 
        added: function(doc){
            userId=doc._id;
            var googleConf=ServiceConfiguration.configurations.findOne({service: 'google'});
            var google = doc.services.google;
            //grabs tokens
            gmailClients[doc._id] = new GMail.Client({
                clientId: googleConf.clientId,
                clientSecret: googleConf.secret,
                accessToken: google.accessToken,
                expirationDate: google.expiresAt,
                refreshToken: google.refreshToken
            });
            //grabs all emails that match keyword the and insert them into a collection
            gmailClients[doc._id].onNewEmail('subject:the', function(message){
                //checks if that email is in the collection already
                if (Email.find({email: message._id}).count()==0){
                    Email.insert({
                        date:message.date, 
                        to:message.to, 
                        from:message.from, 
                        subject:message.subject,
                        user:doc._id,
                        email:message._id
                    })
                }
            });
        }
    });
    Meteor.methods({
        //regular expression to parse out only emails
        parseEmail: function(text){
            //returns an array
            return text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
        },
        //function that keeps a count of emails
        upsert: function(){
            var data=Email.find({user:userId}).fetch();
            for (i in data){
                //upsert to from collection based on who the email is sent from
                From.upsert({'name': data[i].from}, { $inc: {'count': 1},$set:{user:userId}});
                //parse email with previous method
                Meteor.call('parseEmail',data[i].to,function(error,result){
                    //upert to to collection based on who the email is sent to
                    var name=result.sort().toString();
                    name=name.replace(/\s*,\s*/g,', ');
                    To.upsert({'name':name}, { $inc: {'count': 1},$set:{user:userId}});
                })
            }
        }
    });
}
//client code
else {
    //default page is home page
    Session.set('currentPage', 'home');
    //google accounts configuration
    Accounts.ui.config({
    requestOfflineToken: { google: true },
    forceApprovalPrompt: { google: true },
    requestPermissions: { google: ["https://www.googleapis.com/auth/gmail.readonly"] }
  });
    Template.body.helpers({
        //for the navbar
        homePage: function() {return Session.get('currentPage')=='home';},
        fromPage: function() {return Session.get('currentPage')=='from';},
        toPage: function() {return Session.get('currentPage')=='to';},		
    });
    Template.body.events({
		"click #home": function() {Session.set('currentPage', 'home');},
		"click #from": function() {
            Session.set('currentPage', 'from');
            if (From.find({user:Meteor.userId()}).count()==0){
                           Meteor.call('upsert');
                           setTimeout(graphPie(),6000);
                           if ($("#fromPie").length==0){
                               graphPie()
                           }
                          }
            },
		"click #to": function() {
            Session.set('currentPage', 'to');
            if (To.find({user:Meteor.userId()}).count()==0){
                           Meteor.call('upsert');
                           setTimeout(graphSecPie(),6000);
                           if ($("#toPie").length==0){
                               graphSecPie()
                           }
            }
        }
    });
    //global function that graphs pie
    graphPie=function(){
        //default size
        var w = 900;                       
        var h = 900;
        var r = 300;       
        //function that generates colors
        var color = d3.scale.category20c();
        //grabs top 10 data
        var data=From.find({user:Meteor.userId()},{sort: {count: -1}}).fetch().slice(0,10);
        //graphs pie chart
        var vis = d3.select("#fromPie").data([data]).attr("width", w).attr("height", h).append("svg:g")
        .attr("transform", "translate(" + r + "," + r + ")");
        var arc = d3.svg.arc()
        .outerRadius(r);
        var pie = d3.layout.pie()           
        .value(function(d) { return d.count; });
        var arcs = vis.selectAll("g.slice")
        .data(pie)                      
        .enter()                      
        .append("svg:g")                
        .attr("class", "slice"); 
        arcs.append("svg:path")
        .attr("fill", function(d, i) { return color(i); } ) 
        .attr("d", arc); 
        //generates legends
        var legendRectSize = 18; 
        var legendSpacing = 4; 
        var legend = d3.select("#fromPie").selectAll('.legend')                
        .data(color.domain())                                  
        .enter()                                               
        .append('g')                                         
        .attr('class', 'legend')                               
        .attr('transform', function(d,i){
            var height=legendRectSize + legendSpacing; 
            var offset= height * color.domain().length / 2; 
            var horz=35 * legendRectSize;      
            var vert=i* height - offset+15*legendRectSize;        
            return 'translate(' + horz + ',' + vert + ')';
        }); 
        //generates rectangles for legends
        legend.append('rect')                                     
        .attr('width', legendRectSize)                         
        .attr('height', legendRectSize)                         
        .style('fill', color)
        .style('stroke', color);    
        //appends text
        legend.append('text')                                    
        .attr('x', legendRectSize + legendSpacing)              
        .attr('y', legendRectSize - legendSpacing)              
        .text(function(d) { 
            return data[d].name; 
        });  
    };
    graphSecPie=function(){
        var w = 900;                       
        var h = 900;
        var r = 300;                            
        var color = d3.scale.category20c();
        //retrieves to data
        var data=To.find({user:Meteor.userId()},{sort: {count: -1}}).fetch().slice(0,10);
        var vis = d3.select("#toPie").data([data]).attr("width", w).attr("height", h).append("svg:g")
        .attr("transform", "translate(" + r + "," + r + ")");
        var arc = d3.svg.arc()
        .outerRadius(r);
        var pie = d3.layout.pie()           
       .value(function(d) { return d.count; });
        var arcs = vis.selectAll("g.slice")
        .data(pie)                      
        .enter()                      
        .append("svg:g")                
        .attr("class", "slice"); 
        arcs.append("svg:path")
        .attr("fill", function(d, i) { return color(i); } ) 
        .attr("d", arc); 
        var legendRectSize = 18;                                 
        var legendSpacing = 4;
        //initial height for legneds
        var h=80;
        var offset =  height * color.domain().length / 2;     
        var horz = 35 * legendRectSize;    
        var vert = height - offset+15*legendRectSize;    
        for (var i=0; i<=9; i++){
            var height = legendRectSize + legendSpacing;
            //shifts legend down
            h+=height;
            var legend = d3.select("#toPie")                                      
            .attr('class', 'legend');
            //colors and positions squares
            legend.append('rect')                                    
            .attr('width', legendRectSize)                        
            .attr('height', legendRectSize) 
            .style('fill', color(i))
            .style('stroke', color(i))
            .attr('transform', function() {              
                return 'translate(' + horz + ',' +h+ ')';
        });
            var list=data[i].name;
            var text=legend.append('text');
            //determines the length of the legends
            if (list.indexOf(',')==-1) {
                text
                .attr('x', height)              
                .attr('y', legendRectSize - legendSpacing)              
                .text(list)
                .attr('transform', function() {
                    return 'translate(' + horz + ',' +h+ ')';
                });
            }
            //if there are multiple emails
            else {
                //split by comma
                var long=list.split(',');
                //appends tspan element for every email
                for (var j in long) {     
                    text.append('tspan')
                    .attr('x', height)            
                    .attr('y', j*(legendRectSize-legendSpacing)+legendRectSize-legendSpacing)
                    .text(long[j].trim());
                               
                }
                text.attr('transform', function() {
                    return 'translate(' + horz + ',' + h + ')';
                });
                //increments h
                h+=(long.length-1)*legendRectSize;
            }
        }
    }
        
    Template.from.helpers({
       parsedFrom:function(){
           //returns user data
           return From.find({user:Meteor.userId()},{sort: {count: -1}}).fetch();
       }
  });
    Template.pie.onRendered(function(){
            if (From.find({user:Meteor.userId()}).count()==0){
                           Meteor.call('upsert');
                          }
            setTimeout(graphPie(),3000);
        
    });
    Template.secondPie.onRendered(function(){
        //another function for second pie chart because legend is more complicated
        if (From.find({user:Meteor.userId()}).count()==0){
                           Meteor.call('upsert');
                          }
        setTimeout(graphSecPie(),3000);
    })
    Template.to.helpers({
        parsedTo:function(){
            //returns to data
            return To.find({user:Meteor.userId()},{sort: {count: -1}}).fetch();
        }
    });
}
                            