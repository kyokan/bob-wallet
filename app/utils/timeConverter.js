const createAMPMTimeStamp = timestamp => {
  const date = new Date(timestamp * 1000);
  const year = date
    .getFullYear()
    .toString()
    .slice(2);
  const month = date.getMonth();
  const day = date.getDate();
  const twentyfourHours = date.getHours();
  const m = date.getMinutes();
  const ampm = twentyfourHours >= 12 ? 'PM' : 'AM';
  let twelveHours = twentyfourHours % 12;
  twelveHours = twelveHours || 12; // the hour '0' should be '12'
  const mm = m < 10 ? `0${m}` : m;
  const strTime = `${twelveHours}:${mm} ${ampm}`;
  return {
    year,
    month,
    day,
    strTime
  };
};

export default createAMPMTimeStamp;
