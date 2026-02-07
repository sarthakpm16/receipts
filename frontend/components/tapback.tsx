import { HeartIcon } from "@heroicons/react/24/solid";

export default function Tapback({ transform, emoji } : { transform: string, emoji?: string}) {
  return (
    <div className={`${transform} flex items-center justify-center w-8 h-8 bg-iosBlue rounded-full`}>
      {/* Heart Icon */}
      { emoji ? <h1 className="text-xl">{emoji}</h1> : <HeartIcon className="w-5 h-5 text-pink-300 z-1" /> }
      <div className="absolute bottom-0 right-0 w-2 h-2 bg-iosBlue rounded-full"></div>
      <div className="absolute bottom-0 right-0 w-1 h-1 translate-x-1 translate-y-1 bg-iosBlue rounded-full" />
    </div>
  );
}