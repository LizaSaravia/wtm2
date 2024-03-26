import { Pagination } from './pagination.js';

let paginationData = undefined;
let paginationDataQueries = undefined;
const ITEMS_PER_PAGE = 10;
const ITEMS_PER_QUERY_PAGE = 5;

const handleLogoutUser = async () => {
  await chrome.runtime.sendMessage({ type: 'logout' });
  window.location.replace('./popup-sign-in.html');
};

// -- Config / Setting button -- //
const configButton = document.getElementById('config-button');

configButton.addEventListener('click', function () {
  window.location.replace('./settings/settings.html');
})

// -- Event handling related to tab changes -- //
document.querySelectorAll('.tab-title').forEach(button => {
  button.onclick = (event) => {
    // Remove 'tab-active' class from all tab titles
    document.querySelectorAll('.tab-title').forEach(tab => {
      tab.classList.remove('tab-active');
    });
    // Add 'tab-active' class to the clicked tab title
    event.target.classList.add('tab-active');


    // Remove 'visible' class from tab containers
    document.querySelectorAll('.list-container').forEach(container => {
      if (container.classList.contains('visible')) {
        container.classList.remove('visible');
      }
      else {
        container.classList.add('visible');
      }
    });

    document.querySelectorAll('.pagination-container').forEach(container => {
      if (container.classList.contains('visible-flex')) {
        container.classList.remove('visible-flex');
      }
      else {
        container.classList.add('visible-flex');
      }
    });
    // Add 'tab-active' class to the clicked tab title
    event.target.classList.add('tab-active');
  }
})



// -- Input, Semantic checkbox and Search button -- //
const searchInput = document.getElementById('input');
const searchButton = document.getElementById('search-button');
const semanticCheckbox = document.getElementById('semantic-toggle');

const refreshNavigationHistoryList = (getHistoryRes) => {
  loaderContainer.style.display = 'none';
  if (getHistoryRes && getHistoryRes.items?.length) {
    paginationData = new Pagination(getHistoryRes.count, ITEMS_PER_PAGE);

    getHistoryRes.items.forEach((record) => {
      appendHistoryItem(record);
    });
    //When popup is open, left arrow always is going to be disable
    const leftButton = document.getElementById('left-arrow');
    leftButton.setAttribute('disabled', true);

    if (getHistoryRes.count <= getHistoryRes.limit) {
      const rightButton = document.getElementById('right-arrow');
      rightButton.setAttribute('disabled', true);
    } else {
      emptyHistoryList();
    }

    const paginationInfo = document.getElementById('pagination-info');
    paginationInfo.innerHTML = `${paginationData.getCurrentPage()} / ${paginationData.getTotalPages()}`;
  } else {
    emptyHistoryList(getHistoryRes?.query);
  }
};

searchButton.addEventListener('click', async () => {
  const searchText = searchInput.value;
  sitesList.innerHTML = '';
  loaderContainer.style.display = 'block';

  const getHistoryRes = await chrome.runtime.sendMessage({
    type: 'getHistory',
    offset: 0,
    limit: ITEMS_PER_PAGE,
    search: searchText,
    isSemantic: semanticCheckbox.checked
  });

  if (getHistoryRes.error) {
    handleLogoutUser();
    return;
  }

  refreshNavigationHistoryList(getHistoryRes);
});

const sitesList = document.getElementById('sites-list');
const queriesList = document.getElementById('queries-list');
const loaderContainer = document.getElementById('loader-container');

// Function to create and append history item to list
const appendHistoryItem = (item) => {
  var listItem = document.createElement('div');
  var paragraph = document.createElement('p');
  var deleteIcon = document.createElement('img');
  var anchor = document.createElement('a');

  paragraph.textContent = `${new Date(item.navigationDate).toLocaleString()} - ${item.title}`;
  paragraph.classList.add('truncate');

  deleteIcon.src = './icons/xmark.svg';
  deleteIcon.alt = 'Delete record';
  deleteIcon.addEventListener('click', () => deleteItem(item));

  anchor.href = item.url;
  anchor.target = '_blank';

  anchor.appendChild(paragraph);

  listItem.appendChild(anchor);
  listItem.appendChild(deleteIcon);

  sitesList.appendChild(listItem);
};

const emptyHistoryList = (query) => {
  //Display text
  const paragraph = document.createElement('p');
  paragraph.classList.add('no-records');

  paragraph.textContent = query
    ? 'No results found. Try different search terms!'
    : 'Start browsing to populate your history!';

  sitesList.appendChild(paragraph);

  //Disable arrow buttons
  const leftButton = document.getElementById('left-arrow');
  leftButton.setAttribute('disabled', true);

  const rightButton = document.getElementById('right-arrow');
  rightButton.setAttribute('disabled', true);
};

const deleteItem = async (item) => {
  const searchText = searchInput.value;
  sitesList.innerHTML = '';
  loaderContainer.style.display = 'block';

  const getHistoryRes = await chrome.runtime.sendMessage({
    type: 'deleteHistoryEntry',
    item,
    offset: 0,
    limit: ITEMS_PER_PAGE,
    search: searchText,
  });

  if (getHistoryRes.error) {
    handleLogoutUser();
    return;
  }

  refreshNavigationHistoryList(getHistoryRes);
};


// Function to create and append query item to list
const appendQueryItem = (item) => {
  const queryItem = document.createElement('div');
  const query = document.createElement('p');
  query.textContent = item.query;

  queryItem.appendChild(query);
  item.results.forEach(result => {
    const resultsContainer = document.createElement('div');
    const anchor = document.createElement('a');
    const urlResult = document.createElement('p');
    urlResult.classList.add('truncate');
    urlResult.textContent = `${new Date(result.navigationDate).toLocaleString()} - ${result.title}`;
    anchor.href = result.url;
    anchor.target = '_blank';
    anchor.appendChild(urlResult);
    resultsContainer.appendChild(anchor)
    queryItem.appendChild(resultsContainer);
  })
  queriesList.appendChild(queryItem);
};

const emptyQueriesResult = () => {
  //Display text
  const paragraph = document.createElement('p');
  paragraph.classList.add('no-records');

  paragraph.textContent = 'No results found. Try using the semantic search feature!'

  queriesList.appendChild(paragraph);

  //Disable arrow buttons
  const leftButton = document.getElementById('left-arrow-query');
  leftButton.setAttribute('disabled', true);

  const rightButton = document.getElementById('right-arrow-query');
  rightButton.setAttribute('disabled', true);
};


document.addEventListener('DOMContentLoaded', async () => {
  const getHistoryRes = await chrome.runtime.sendMessage({
    type: 'getHistory',
    offset: 0,
    limit: ITEMS_PER_PAGE,
    search: '',
    isSemantic: false
  });

  const getQueriesRes = await chrome.runtime.sendMessage({
    type: 'getQueries',
    offset: 0,
    limit: ITEMS_PER_QUERY_PAGE,
  });

  if ((getHistoryRes && getHistoryRes.error) || (getQueriesRes && getQueriesRes.error)) {
    handleLogoutUser();
    return;
  }

  loaderContainer.style.display = 'none';
  if (getHistoryRes && getHistoryRes.items?.length) {
    paginationData = new Pagination(getHistoryRes.count, ITEMS_PER_PAGE);

    getHistoryRes.items.forEach((record) => {
      appendHistoryItem(record);
    });

    if (getHistoryRes.count <= getHistoryRes.limit) {
      const rightButton = document.getElementById('right-arrow');
      rightButton.setAttribute('disabled', true);
    }
    const paginationInfo = document.getElementById('pagination-info');
    paginationInfo.innerHTML = `${paginationData.getCurrentPage()} / ${paginationData.getTotalPages()}`;
  } else {
    emptyHistoryList(getHistoryRes?.query);
  }
  if (getQueriesRes && getQueriesRes.items?.length) {
    paginationDataQueries = new Pagination(getQueriesRes.count, ITEMS_PER_QUERY_PAGE);

    getQueriesRes.items.forEach(appendQueryItem)
    const leftButton = document.getElementById('left-arrow-query');
    leftButton.setAttribute('disabled', true);
    if (getQueriesRes.count <= getQueriesRes.limit) {
      const rightButton = document.getElementById('right-arrow-query');
      rightButton.setAttribute('disabled', true);
    }
    const paginationInfo = document.getElementById('pagination-info-query');
    paginationInfo.innerHTML = `${paginationDataQueries.getCurrentPage()} / ${paginationDataQueries.getTotalPages()}`;
  } else {
    emptyQueriesResult()
  }
});

// Pagination
const leftButton = document.getElementById('left-arrow');

leftButton.addEventListener('click', async () => {
  paginationData.prevPage();
  sitesList.innerHTML = '';
  loaderContainer.style.display = 'block';
  const searchText = searchInput.value;

  const response = await chrome.runtime.sendMessage({
    type: 'getHistory',
    offset: paginationData.getStartIndex(),
    limit: ITEMS_PER_PAGE,
    search: searchText,
    isSemantic: semanticCheckbox.checked
  });

  if (response.error) {
    handleLogoutUser();
    return;
  }

  loaderContainer.style.display = 'none';
  if (response && response.items?.length) {
    response.items.forEach((record) => {
      appendHistoryItem(record);
    });

    if (response.error) {
      handleLogoutUser();
      return;
    }

    loaderContainer.style.display = 'none';
    if (response && response.items?.length) {
      response.items.forEach((record) => {
        appendHistoryItem(record);
      });

      if (response.offset == 0) {
        const leftButton = document.getElementById('left-arrow');
        leftButton.setAttribute('disabled', true);
      }

      //When user move to the previous page, right arrow always is going to be enable
      const rightButton = document.getElementById('right-arrow');
      rightButton.removeAttribute('disabled');

      const paginationInfo = document.getElementById('pagination-info');
      paginationInfo.innerHTML = `${paginationData.getCurrentPage()} / ${paginationData.getTotalPages()}`;
    }
  }
});

const rightButton = document.getElementById('right-arrow');

rightButton.addEventListener('click', async () => {
  paginationData.nextPage();
  sitesList.innerHTML = '';
  loaderContainer.style.display = 'block';
  const searchText = searchInput.value;

  const response = await chrome.runtime.sendMessage({
    type: 'getHistory',
    offset: paginationData.getStartIndex(),
    limit: ITEMS_PER_PAGE,
    search: searchText,
    isSemantic: semanticCheckbox.checked

  });

  if (response.error) {
    handleLogoutUser();
    return;
  }

  loaderContainer.style.display = 'none';
  if (response && response.items?.length) {
    response.items.forEach((record) => {
      appendHistoryItem(record);
    });

    if (response.error) {
      handleLogoutUser();
      return;
    }

    loaderContainer.style.display = 'none';
    if (response && response.items?.length) {
      response.items.forEach((record) => {
        appendHistoryItem(record);
      });

      //When user move to the next page, left arrow always is going to be enable
      const leftButton = document.getElementById('left-arrow');
      leftButton.removeAttribute('disabled');

      if (response.limit + response.offset >= response.count) {
        const rightButton = document.getElementById('right-arrow');
        rightButton.setAttribute('disabled', true);
      }

      const paginationInfo = document.getElementById('pagination-info');
      paginationInfo.innerHTML = `${paginationData.getCurrentPage()} / ${paginationData.getTotalPages()}`;
    }
  }
});



// Pagination query
const leftButtonQueries = document.getElementById('left-arrow-query');

leftButtonQueries.addEventListener('click', async () => {
  paginationDataQueries.prevPage();
  queriesList.innerHTML = '';
  loaderContainer.style.display = 'block';

  const response = await chrome.runtime.sendMessage({
    type: 'getQueries',
    offset: paginationDataQueries.getStartIndex(),
    limit: ITEMS_PER_QUERY_PAGE
  });

  if (response.error) {
    handleLogoutUser();
    return;
  }


  loaderContainer.style.display = 'none';
  if (response && response.items?.length) {
    response.items.forEach(appendQueryItem)

    if (response.offset == 0) {
      const leftButton = document.getElementById('left-arrow-query');
      leftButton.setAttribute('disabled', true);
    }

    //When user move to the previous page, right arrow always is going to be enable
    const rightButton = document.getElementById('right-arrow-query');
    rightButton.removeAttribute('disabled');

    const paginationInfo = document.getElementById('pagination-info-query');
    paginationInfo.innerHTML = `${paginationDataQueries.getCurrentPage()} / ${paginationDataQueries.getTotalPages()}`;
  }

});

const rightButtonQueries = document.getElementById('right-arrow-query');

rightButtonQueries.addEventListener('click', async () => {
  paginationDataQueries.nextPage();
  queriesList.innerHTML = '';
  loaderContainer.style.display = 'block';

  
  const response = await chrome.runtime.sendMessage({
    type: 'getQueries',
    offset: paginationDataQueries.getStartIndex(),
    limit: ITEMS_PER_QUERY_PAGE
  });
  
  if (response.error) {
    handleLogoutUser();
    return;
  }

  loaderContainer.style.display = 'none';
  if (response && response.items?.length) {
    response.items.forEach(appendQueryItem)
    //When user move to the next page, left arrow always is going to be enable
    const leftButton = document.getElementById('left-arrow-query');
    leftButton.removeAttribute('disabled');

    if (response.limit + response.offset >= response.count) {
      const rightButton = document.getElementById('right-arrow-query');
      rightButton.setAttribute('disabled', true);
    }

    const paginationInfo = document.getElementById('pagination-info-query');
    paginationInfo.innerHTML = `${paginationDataQueries.getCurrentPage()} / ${paginationDataQueries.getTotalPages()}`;
  }

});