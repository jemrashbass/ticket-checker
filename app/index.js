// Wigmore Hall Ticket Availability Checker (Advanced Version)
// This script checks Wigmore Hall's website for ticket availability and sends Gmail notifications

// Required packages (you'll need to install these):
// npm install axios cheerio node-schedule nodemailer dotenv fs path

// Load environment variables from .env file
require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');
const schedule = require('node-schedule');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

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

// Path to the concerts configuration file
const concertsConfigPath = path.join(__dirname, 'concerts.json');

// Function to load concerts from config file
function loadConcertsConfig() {
  try {
    // Check if the config file exists
    if (!fs.existsSync(concertsConfigPath)) {
      // Create a default config file if it doesn't exist
      const defaultConcerts = [
        {
          "name": "Example Concert (Replace with actual concert)",
          "url": "https://wigmore-hall.org.uk/whats-on/example-concert",
          "date": "2025-05-01", // YYYY-MM-DD format
          "lastChecked": null,
          "wasAvailable": false
        }
      ];
      fs.writeFileSync(concertsConfigPath, JSON.stringify(defaultConcerts, null, 2));
      console.log(`Created default concerts config at ${concertsConfigPath}`);
      return defaultConcerts;
    }

    // Read and parse the config file
    const configData = fs.readFileSync(concertsConfigPath, 'utf8');
    const concerts = JSON.parse(configData);
    
    // Ensure each concert has the required properties
    concerts.forEach(concert => {
      concert.lastChecked = concert.lastChecked || null;
      concert.wasAvailable = concert.wasAvailable || false;
      // Ensure date is in proper format if provided
      if (concert.date && !/^\d{4}-\d{2}-\d{2}$/.test(concert.date)) {
        console.warn(`Warning: Concert "${concert.name}" has invalid date format. Use YYYY-MM-DD.`);
      }
    });
    
    console.log(`Loaded ${concerts.length} concerts from config`);
    return concerts;
  } catch (error) {
    console.error(`Error loading concerts config: ${error.message}`);
    return [];
  }
}

// Function to save concerts config with updated status
function saveConcertsConfig(concerts) {
  try {
    fs.writeFileSync(concertsConfigPath, JSON.stringify(concerts, null, 2));
  } catch (error) {
    console.error(`Error saving concerts config: ${error.message}`);
  }
}

// Function to check if a concert date has passed
function concertHasPassed(dateStr) {
  if (!dateStr) return false;
  
  try {
    const concertDate = new Date(dateStr);
    const today = new Date();
    
    // Reset today's time to start of day for fair comparison
    today.setHours(0, 0, 0, 0);
    
    return concertDate < today;
  } catch (error) {
    console.error(`Error checking concert date: ${error.message}`);
    return false;
  }
}

// Function to determine check priority based on date proximity
function getCheckPriority(dateStr) {
  if (!dateStr) return 'normal';
  
  try {
    const concertDate = new Date(dateStr);
    const today = new Date();
    
    // Calculate days until concert
    const daysUntilConcert = Math.ceil((concertDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilConcert <= 3) return 'high';   // Within 3 days
    if (daysUntilConcert <= 7) return 'medium'; // Within a week
    return 'normal';
  } catch (error) {
    console.error(`Error calculating check priority: ${error.message}`);
    return 'normal';
  }
}

// Load concerts from config file
let concertsToMonitor = loadConcertsConfig();

// Function to check if tickets are available for a specific concert
async function checkTicketAvailability(concert) {
  try {
    console.log(`Checking availability for: ${concert.name} ${concert.date ? `(Date: ${concert.date})` : ''}`);
    
    // Make HTTP request to the concert page
    const response = await axios.get(concert.url);
    const html = response.data;
    
    // Load HTML into cheerio for parsing
    const $ = cheerio.load(html);
    
    // Look for booking buttons/links with "Book now" text
    const bookingElements = $('a[href*="/booking/"], div[href*="/booking/"]');
    
    // Check if there's any element containing "Book now" (available) vs. "Sold out" (unavailable)
    let ticketsAvailable = false;
    bookingElements.each(function() {
      const elementText = $(this).text().trim();
      if (elementText.includes('Book now')) {
        ticketsAvailable = true;
        return false; // break the loop if we found an available ticket
      }
    });
    
    console.log(`Booking elements found: ${bookingElements.length}`);
    console.log(`Ticket availability status: ${ticketsAvailable ? 'AVAILABLE' : 'SOLD OUT'}`);
    
    // Update last checked time
    concert.lastChecked = new Date().toISOString();
    
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
    // Add date information to the email if available
    const dateInfo = concert.date 
      ? `<p><strong>Date:</strong> ${new Date(concert.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>`
      : '';
      
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: notificationEmail,
      subject: `🎵 Tickets Available: ${concert.name} at Wigmore Hall`,
      html: `
        <h2>Tickets are now available!</h2>
        <p><strong>Concert:</strong> ${concert.name}</p>
        ${dateInfo}
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

// Function to filter only active concerts (not passed) and prioritize them
function filterAndPrioritizeConcerts(allConcerts) {
  // Filter out past concerts
  const activeConcerts = allConcerts.filter(concert => !concertHasPassed(concert.date));
  
  if (allConcerts.length !== activeConcerts.length) {
    console.log(`Skipping ${allConcerts.length - activeConcerts.length} concerts that have already passed.`);
  }
  
  // Sort concerts by priority (closer dates first)
  activeConcerts.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;  // Concerts without dates go last
    if (!b.date) return -1; // Concerts with dates go first
    return new Date(a.date) - new Date(b.date);
  });
  
  return activeConcerts;
}

// Function to check all concerts
async function checkAllConcerts() {
  console.log(`Running check at ${new Date().toLocaleString()}`);
  
  // Reload the concerts config file each time to catch any changes
  concertsToMonitor = loadConcertsConfig();
  
  // Filter out passed concerts and prioritize the rest
  const activeConcerts = filterAndPrioritizeConcerts(concertsToMonitor);
  
  // Check if we have any concerts to monitor
  if (activeConcerts.length === 0) {
    console.log('No active concerts to monitor.');
    return;
  }
  
  // Check each active concert
  for (const concert of activeConcerts) {
    const priority = getCheckPriority(concert.date);
    console.log(`Checking concert with ${priority} priority: ${concert.name}`);
    
    const available = await checkTicketAvailability(concert);
    console.log(`${concert.name}: ${available ? 'AVAILABLE! 🎉' : 'Still sold out'}`);
  }
  
  // Update status for all concerts (including those that have passed)
  saveConcertsConfig(concertsToMonitor);
}

// Schedule checks with priority-based frequency
function scheduleChecks() {
  // Get base check frequency from environment variable or use default (hourly)
  const baseCheckFrequency = process.env.CHECK_FREQUENCY || '0 * * * *';
  
  console.log(`Base check frequency: ${baseCheckFrequency}`);
  
  // Set up standard hourly check for all concerts
  const standardJob = schedule.scheduleJob(baseCheckFrequency, checkAllConcerts);
  
  // Additional check for high priority concerts (concerts within 3 days)
  // Check every 15 minutes for upcoming concerts
  const highPriorityJob = schedule.scheduleJob('*/15 * * * *', async function() {
    console.log('Running high-priority check for upcoming concerts');
    
    // Reload config to get the latest concerts
    const concerts = loadConcertsConfig();
    
    // Filter concerts happening soon (within 3 days)
    const urgentConcerts = concerts.filter(concert => {
      if (!concert.date) return false;
      const priority = getCheckPriority(concert.date);
      return priority === 'high' && !concertHasPassed(concert.date);
    });
    
    if (urgentConcerts.length === 0) {
      console.log('No high-priority concerts to check.');
      return;
    }
    
    console.log(`Checking ${urgentConcerts.length} high-priority concerts`);
    
    // Check each high-priority concert
    for (const concert of urgentConcerts) {
      console.log(`High-priority check for: ${concert.name} (Date: ${concert.date})`);
      const available = await checkTicketAvailability(concert);
      console.log(`${concert.name}: ${available ? 'AVAILABLE! 🎉' : 'Still sold out'}`);
    }
    
    // Save updated status
    saveConcertsConfig(concerts);
  });
  
  console.log('Ticket checker started with priority-based scheduling:');
  console.log('- Regular checks: ' + baseCheckFrequency);
  console.log('- High priority checks (concerts within 3 days): every 15 minutes');
  
  // Log the concerts we're monitoring
  const activeConcerts = concertsToMonitor.filter(concert => !concertHasPassed(concert.date));
  console.log(`Monitoring ${activeConcerts.length} active concerts:`);
  activeConcerts.forEach(concert => {
    const priority = getCheckPriority(concert.date);
    console.log(`- ${concert.name}: ${concert.url} ${concert.date ? `(Date: ${concert.date}, Priority: ${priority})` : ''}`);
  });
  
  // Run an immediate check when starting the app
  checkAllConcerts();
  
  return { standardJob, highPriorityJob };
}

// Start the scheduler
const jobs = scheduleChecks();

// For manual testing, you can uncomment this line:
// checkAllConcerts();