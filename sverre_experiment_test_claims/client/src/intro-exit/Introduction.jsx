import React from "react";
import { Button } from "../components/Button";

export function Introduction({ next }) {
  return (
    <div className="mt-3 sm:mt-5 p-20">
      <h3 className="text-lg leading-6 font-medium text-gray-900">
        Marketplace Instructions
      </h3>
      <div className="mt-2 mb-6">
        {/* <p className="text-sm text-gray-500"> */}
        <p>
          In this marketplace, you will have to choose what your priorities are as an advertiser. You will be shown multiple products.
        <br />
          In <strong>each round of the game</strong>, you will:
        </p>
        <br />
        <p>
          (a) choose which product to sell based on their quality and price.
        </p>
        <p> 
          (b) obtain the results, gains and losses, based on the sales from the product you chose to advertise. 
        </p>
      </div>
      <Button handleClick={next} autoFocus>
        <p>Next</p>
      </Button>
    </div>
  );
}
