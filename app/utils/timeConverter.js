const createAMPMTimeStamp = timestamp => {
  const date = new Date(timestamp * 1000);
  const year = date
    .getFullYear()
    .toString()
    .slice(2);
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return {
    year,
    month,
    day,
  };
};

function pad(num) {
  if (num < 10) {
    return `0${num}`
  }

  return num.toString();
}

export default createAMPMTimeStamp;
