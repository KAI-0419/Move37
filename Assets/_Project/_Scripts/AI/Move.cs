namespace Move37.AI
{
    public struct Move
    {
        public int FromX;
        public int FromY;
        public int ToX;
        public int ToY;
        public int Score; // 점수 저장용

        public Move(int fromX, int fromY, int toX, int toY, int score = 0)
        {
            FromX = fromX;
            FromY = fromY;
            ToX = toX;
            ToY = toY;
            Score = score;
        }
    }
}

