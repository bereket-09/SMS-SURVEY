// POST /api/sms/receive
const receiveSMS = (req, res) => {
  // Logic for handling incoming SMS messages from the SMS gateway
};

module.exports = {
  receiveSMS,
};



// Function to validate the user value
function validateUser(user) {
  const regex = /^(07\d{8}|2517\d{8}|\+2517\d{8}|7\d{8})$/;
  return regex.test(user);
}

// Function to format the user value to 2517xxxxxxxx
function formatUser(user) {
  const regex = /^(07\d{8}|2517\d{8}|\+2517\d{8}|7\d{8})$/;
  const match = regex.exec(user);
  if (match) {
    const phoneNumber = match[0].replace(/\D/g, ""); // Remove non-digit characters
    if (phoneNumber.startsWith("07")) {
      return `2517${phoneNumber.slice(2)}`;
    } else if (phoneNumber.startsWith("7")) {
      return `2517${phoneNumber.slice(1)}`;
    } else if (phoneNumber.startsWith("2517")) {
      return phoneNumber;
    } else if (phoneNumber.startsWith("+2517")) {
      return phoneNumber.slice(1);
    }
  }
  return user;
}