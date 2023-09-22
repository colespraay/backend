const dateTime = new Date();

const date = `${dateTime.getDate()}/${
  dateTime.getMonth() + 1
}/${dateTime.getFullYear()}`;

const options = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true, // Use 12-hour format
};

const formattedTime = new Intl.DateTimeFormat('en-US', options).format(
  dateTime,
);

console.log(formattedTime); // Output will be something like "01:56 PM"
