const socket = io(window.location.href);
const details = document.querySelector("#trackDetails");
socket.on("newTrack", (track) => {
  details.innerHTML = `<li><b>Now playing:</b> ${track.fileName}</li>`;
  const trackData = Object.entries(track.track.common).filter(
    (d) => typeof d[1] == "string"
  );
  console.log(trackData);
  for (const data of trackData) {
    const li = document.createElement("li");
    li.innerHTML = `<b>${data[0].charAt(0).toUpperCase()}${data[0].slice(
      1
    )}:</b> ${data[1]}`;
    details.append(li);
  }
});
