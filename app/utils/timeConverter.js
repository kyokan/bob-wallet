const createAMPMTimeStamp = timestamp => {
  const date = new Date(timestamp);
  const year = date
    .getFullYear()
    .toString()
    .slice(2);
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  h = h ? h : 12; // the hour '0' should be '12'
  const mm = m < 10 ? '0'+m : m;
  const time = h + ':' + mm + ' ' + ampm;
  return {
    year,
    month,
    day,
    time
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
