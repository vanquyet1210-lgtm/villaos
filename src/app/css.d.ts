// Type declaration for CSS modules and global CSS imports
declare module '*.css' {
  const styles: { [className: string]: string };
  export default styles;
}
