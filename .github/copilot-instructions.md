The React version is in react-version folder and the lagcacy version is in legacy-version folder.
The project use pnpm as package manager
the react version is in React 19 and typescript 5
It respects standard React practices and uses functional components with hooks.
The code is structured to be modular and reusable, following best practices for React development.
Each component with will be documented with comments explaining its purpose and functionality.
Each component will be small
Each component will be tested with vitest and react testing library
To launch the project, run `pnpm install` to install dependencies, then `pnpm dev` to start the development server. in /react-version folder.
A React component is created like that:

```tsx
type MyComponentProps = {
  message: string;
};
export const MyComponent = ({ message }: MyComponentProps) => {
  return (
    <div>
      <h1>{message}</h1>
    </div>
  );
};
```

If needed, you can update the README.md file to reflect any changes or additional instructions.