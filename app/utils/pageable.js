export function getPageIndices(transactions, itemsPerPage, currentPageIndex) {
  const totals = Math.ceil(transactions.length / itemsPerPage);
  const results = [];

  if (totals < 7) {
    return Array(totals)
      .fill(0)
      .map((_, n) => n);
  }

  results.push(0);

  for (let i = currentPageIndex - 1; i < currentPageIndex + 2; i++) {
    if (i >= 0 && i < totals) {
      results.push(i);
    }
  }

  results.push(totals - 1);
  const pageIndices = [ ...new Set(results) ];

  const answer = [];
  pageIndices.forEach((pageIndex, index) => {
    if (index === 0) {
      answer.push(pageIndex);
      return;
    }

    if (pageIndices[index - 1] + 1 !== pageIndices[index]) {
      answer.push('...');
    }

    answer.push(pageIndex);
  });
  return answer;
}
