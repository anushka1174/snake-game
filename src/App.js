import GameBoard from "./components/GameBoard";

function App() {
  // temporary snake + food positions just to test the board
  const snake = [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 3, y: 5 }
  ];

  const food = { x: 10, y: 10 };

  return (
    <div className="App">
      <GameBoard snake={snake} food={food} />
    </div>
  );
}

export default App;
