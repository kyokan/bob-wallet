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

export function hoursToNow(hoursUntil) {
  if (!hoursUntil) {
    return 'N/A';
  }

  if (hoursUntil < 24) {
    const hours = Math.floor(hoursUntil % 24);
    const mins = Math.floor((hoursUntil % 1) * 60);
    return `~${hours}h ${mins}m`
  }

  const days = Math.floor(hoursUntil / 24);
  const hours = Math.floor(hoursUntil % 24);
  const mins = Math.floor((hoursUntil % 1) * 60);
  return `~${days}d ${hours}h ${mins}m`
}

export default createAMPMTimeStamp;
