// Wigmore Hall Ticket Availability Checker
// This script checks Wigmore Hall's website for ticket availability and sends Gmail notifications

// Required packages (you'll need to install these):
// npm install axios cheerio node-schedule nodemailer dotenv

// Load environment variables from .env file
require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');
const schedule = require('node-schedule');
const nodemailer = require('nodemailer');

// Configure Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD // This should be an app password, not your regular Gmail password
  }
});

// Email notification settings
const notificationEmail = process.env.NOTIFICATION_EMAIL; // Where to send notifications

// Wigmore Hall concert URLs to monitor
// Add URLs of the sold-out concerts you're interested in
const concertsToMonitor = [
  {
    name: "Chamber_Tots 1",
    url: "https://www.wigmore-hall.org.uk/whats-on/202504241015",
    lastChecked: null,
    wasAvailable: false
  },
  {
    name: "Chamber_Tots 2",
    url: "https://www.wigmore-hall.org.uk/whats-on/202504241145",
    lastChecked: null,
    wasAvailable: false
  }
  {
    name: "Christian Gerhaher and Gerold Huber",
    url: "https://www.wigmore-hall.org.uk/whats-on/202504241930",
    lastChecked: null,
    wasAvailable: false
  }
];

// Function to check if tickets are available for a specific concert
async function checkTicketAvailability(concert) {
  try {
    console.log(`Checking availability for: ${concert.name}`);
    
    // Make HTTP request to the concert page
    const response = await axios.get(concert.url);
    const html = response.data;
    
    // Load HTML into cheerio for parsing
    const $ = cheerio.load(html);
    
    // This selector needs to be updated based on Wigmore Hall's actual website structure
    // You'll need to inspect their HTML to find the right selector for ticket availability
    const availabilityElement = $('.ticket-availability');
    
    // Update this logic based on how Wigmore Hall indicates ticket availability
    const ticketsAvailable = !availabilityElement.text().includes('Sold out');
    
    // Update last checked time
    concert.lastChecked = new Date();
    
    // If tickets are available and weren't available last time we checked, send notification
    if (ticketsAvailable && !concert.wasAvailable) {
      await sendEmailNotification(concert);
      concert.wasAvailable = true;
    } else if (!ticketsAvailable) {
      concert.wasAvailable = false;
    }
    
    return ticketsAvailable;
  } catch (error) {
    console.error(`Error checking ${concert.name}:`, error.message);
    return false;
  }
}

// Function to send email notification
async function sendEmailNotification(concert) {
  try {
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: notificationEmail,
      subject: `🎵 Tickets Available: ${concert.name} at Wigmore Hall`,
      html: `
        <h2>Tickets are now available!</h2>
        <p><strong>Concert:</strong> ${concert.name}</p>
        <p><strong>Book here:</strong> <a href="${concert.url}">${concert.url}</a></p>
        <p>Hurry! Returned tickets often sell quickly.</p>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email notification sent for ${concert.name}. Message ID: ${info.messageId}`);
  } catch (error) {
    console.error('Error sending email notification:', error.message);
  }
}

// Function to check all concerts
async function checkAllConcerts() {
  console.log(`Running check at ${new Date().toLocaleString()}`);
  
  for (const concert of concertsToMonitor) {
    const available = await checkTicketAvailability(concert);
    console.log(`${concert.name}: ${available ? 'AVAILABLE! 🎉' : 'Still sold out'}`);
  }
}

// Schedule regular checks (e.g., every hour)
function scheduleChecks() {
  // Check every hour
  const job = schedule.scheduleJob('0 * * * *', checkAllConcerts);
  
  console.log('Ticket checker started. Will check hourly.');
  console.log('Monitoring these concerts:');
  concertsToMonitor.forEach(concert => console.log(`- ${concert.name}: ${concert.url}`));
  
  // Also run an immediate check when starting the app
  checkAllConcerts();
  
  return job;
}

// Start the scheduler
const job = scheduleChecks();

// For manual testing, you can uncomment this line:
// checkAllConcerts();