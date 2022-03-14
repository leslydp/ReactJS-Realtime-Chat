
//Encrypting text
function encrypt(text) {
  let cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString("hex"), encryptedData: encrypted.toString("hex") };
}

// Decrypting text
function decrypt(text) {
  let iv = Buffer.from(text.iv, "hex");
  let encryptedText = Buffer.from(text.encryptedData, "hex");
  let decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Keep track of which names are used so that there are no duplicates
var userNames = (function () {
  var names = {};

  var claim = function (name) {
    if (!name || names[name]) {
      return false;
    } else {
      names[name] = true;
      return true;
    }
  };

  // find the lowest unused "guest" name and claim it
  var getGuestName = function () {
    var name,
      nextUserId = 1;

    do {
      name = "Guest " + nextUserId;
      nextUserId += 1;
    } while (!claim(name));

    return name;
  };

  // serialize claimed names as an array
  var get = function () {
    var res = [];
    for (user in names) {
      res.push(user);
    }

    return res;
  };

  var free = function (name) {
    if (names[name]) {
      delete names[name];
    }
  };

  return {
    claim: claim,
    free: free,
    get: get,
    getGuestName: getGuestName,
  };
})();

// export function for listening to the socket
module.exports = function (socket) {
  var name = userNames.getGuestName();
  const data = "key";
  // send the new user their name and a list of users
  socket.emit("init", {
    name: name,
    users: userNames.get(),
  });

  // notify other clients that a new user has joined
  socket.broadcast.emit("user:join", {
    name: name,
  });

  // broadcast a user's message to other users
  socket.on("send:message", function (data) {
    socket.broadcast.emit("send:message", {
      user: name,
      text: data.text,
    });
  });

  // validate a user's name change, and broadcast it on success
  socket.on("change:name", function (data, fn) {
    if (userNames.claim(data.name)) {
      var oldName = name;
      userNames.free(oldName);

      name = data.name;

      socket.broadcast.emit("change:name", {
        oldName: oldName,
        newName: name,
      });

      fn(true);
    } else {
      fn(false);
    }
  });

  // clean up when a user leaves, and broadcast it to other users
  socket.on("disconnect", function () {
    socket.broadcast.emit("user:left", {
      name: name,
    });
    userNames.free(name);
  });
};
