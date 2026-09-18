// Development uses the same Firebase project as production until a separate one is created.
// Set useEmulators to true only when the Firebase Emulator Suite (Java 21+) is running locally.
export const environment = {
  production: false,
  useEmulators: false,
  firebase: {
    apiKey: 'AIzaSyAn-modydY3JswpAj3XuKNp_3_oUdPMgao',
    authDomain: 'le-mie-finanze-9280f.firebaseapp.com',
    projectId: 'le-mie-finanze-9280f',
    appId: '1:972431270503:web:b90e618909b0df10f2aac2',
  },
};
