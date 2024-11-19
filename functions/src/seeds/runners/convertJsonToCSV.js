const clients = require('../data/clientes.json');

const fs = require('fs');

function removeHistoryAndConvertToCSV(jsonData) {
  // Clean the data by removing history

  const cleanData = jsonData.filter(e => {
    if (!e.history) return false;
    if (Object.values(e.history).length === 0) return false;
    if (e.address == '' && e.phone == '' && e.email == '') return false;
    return true;
  }).map(item => {
    const cleanItem = { ...item };
    delete cleanItem.history;
    return cleanItem;
  });

  // Get headers from the first object
  const headers = Object.keys(cleanData[0]);

  // Create CSV rows
  const csvRows = [];

  // Add header row
  csvRows.push(headers.join(','));

  // Add data rows
  let rowCounter = 0;
  cleanData.forEach(item => {
    rowCounter++;
    const values = headers.map(header => {
      const value = item[header] || '';
      // Handle values that might contain commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  });
  console.log(`Processed ${rowCounter} rows`);
  return csvRows.join('\n');
}

// Function to save CSV to file
function saveToFile(csvContent, filename = 'data.csv') {
  try {
    fs.writeFileSync(filename, csvContent);
    console.log(`Successfully saved to ${filename}`);
  } catch (err) {
    console.error('Error saving file:', err);
  }
}

// If your JSON is in a variable:
function convertJsonToCSV(jsonData, outputFile = 'output.csv') {
  try {
    const csvContent = removeHistoryAndConvertToCSV(jsonData);
    saveToFile(csvContent, outputFile);
  } catch (err) {
    console.error('Error processing data:', err);
  }
}

convertJsonToCSV(Object.values(clients));
