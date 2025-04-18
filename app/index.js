// Wigmore Hall Ticket Availability Checker
// This script checks Wigmore Hall's website for ticket availability and sends WhatsApp notifications

// Required packages (you'll need to install these):
// npm install axios cheerio node-schedule twilio dotenv

// Load environment variables from .env file
require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');
const schedule = require('node-schedule');
const twilio = require('twilio');

// Initialize Twilio client for WhatsApp messaging
// You'll need to sign up for Twilio and use their WhatsApp API
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Your WhatsApp number (where you want to receive notifications)
const yourWhatsAppNumber = process.env.YOUR_WHATSAPP_NUMBER;

// Twilio's WhatsApp number (provided by Twilio when you set up WhatsApp integration)
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

// Wigmore Hall concert URLs to monitor
// Add URLs of the sold-out concerts you're interested in
const concertsToMonitor = [
  {
    name: "Example Concert 1",
    url: "https://wigmore-hall.org.uk/whats-on/example-concert-1",
    lastChecked: null,
    wasAvailable: false
  },
  {
    name: "Example Concert 2",
    url: "https://wigmore-hall.org.uk/whats-on/example-concert-2",
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
      await sendWhatsAppNotification(concert);
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

// Function to send WhatsApp notification
async function sendWhatsAppNotification(concert) {
  try {
    const message = await twilioClient.messages.create({
      body: `🎵 Tickets now available for "${concert.name}" at Wigmore Hall! Book here: ${concert.url}`,
      from: `whatsapp:${twilioWhatsAppNumber}`,
      to: `whatsapp:${yourWhatsAppNumber}`
    });
    
    console.log(`WhatsApp notification sent for ${concert.name}. SID: ${message.sid}`);
  } catch (error) {
    console.error('Error sending WhatsApp notification:', error.message);
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

// Create a .env file with the following variables:
// TWILIO_ACCOUNT_SID=your_twilio_account_sid
// TWILIO_AUTH_TOKEN=your_twilio_auth_token
// YOUR_WHATSAPP_NUMBER=your_whatsapp_number (with country code, e.g. +447123456789)
// TWILIO_WHATSAPP_NUMBER=twilio_whatsapp_number (provided by Twilio)

// Start the scheduler
const job = scheduleChecks();

// For manual testing, you can uncomment this line:
// checkAllConcerts();